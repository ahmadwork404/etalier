import type express from "express";
import { z } from "zod";
import { scoped } from "../db.js";
import { wrap, ok, tenantContext, feature } from "../runtime.js";
import { HttpError } from "../security.js";

export function register(app: express.Express) {
  app.get(
    "/api/v1/services/:id/insights",
    wrap(async (req, res) => {
      const session = await tenantContext(req, "services.read");
      await feature(session.tenant_id, "services", session.plan);
      const id = z.string().uuid().parse(req.params.id);
      let financeAllowed = true;
      try {
        await tenantContext(req, "finance.read");
        await feature(session.tenant_id, "pos", session.plan);
      } catch (error) {
        if (error instanceof HttpError && error.status === 403)
          financeAllowed = false;
        else throw error;
      }
      ok(
        res,
        await scoped(session.tenant_id, async (c) => {
          const service = (
            await c.query(
              "SELECT id,name,active,price_minor,duration_minutes,buffer_minutes,icon_key,image_version FROM services WHERE tenant_id=$1 AND id=$2",
              [session.tenant_id, id],
            )
          ).rows[0];
          if (!service) throw new HttpError(404, "Service not found");
          const params = [session.tenant_id, id, session.branch_id];
          const visits = `SELECT a.id,a.customer_id,a.status,a.starts_at,s.price_minor FROM appointment_services s JOIN appointments a ON a.id=s.appointment_id AND a.tenant_id=s.tenant_id WHERE s.tenant_id=$1 AND s.service_id=$2 AND ($3::uuid IS NULL OR a.branch_id=$3) UNION ALL SELECT v.id,v.customer_id,'completed',v.created_at,qs.price_minor FROM quick_work_services qs JOIN quick_work_visits v ON v.id=qs.visit_id AND v.tenant_id=qs.tenant_id WHERE qs.tenant_id=$1 AND qs.service_id=$2 AND ($3::uuid IS NULL OR v.branch_id=$3)`;
          const attendance = (
            await c.query(
              `WITH visits AS (${visits}) SELECT count(*)::integer bookings,count(*) FILTER(WHERE status='completed')::integer completed,count(*) FILTER(WHERE status='no_show')::integer no_show,count(*) FILTER(WHERE status='cancelled')::integer cancelled,count(*) FILTER(WHERE starts_at>=now() AND status NOT IN ('completed','cancelled','no_show','rescheduled'))::integer upcoming,count(DISTINCT customer_id) FILTER(WHERE status='completed')::integer customers FROM visits`,
              params,
            )
          ).rows[0];
          const monthly = (
            await c.query(
              `WITH visits AS (${visits}), months AS (SELECT generate_series(date_trunc('month',now())-interval '5 months',date_trunc('month',now()),interval '1 month') month_start) SELECT to_char(m.month_start,'Mon YY') AS month_label,count(v.id) FILTER(WHERE v.status='completed')::integer completed,COALESCE(sum(v.price_minor) FILTER(WHERE v.status='completed'),0) completed_value_minor FROM months m LEFT JOIN visits v ON date_trunc('month',v.starts_at)=m.month_start GROUP BY m.month_start ORDER BY m.month_start`,
              params,
            )
          ).rows;
          let financial = null;
          if (financeAllowed) {
            const completed = (
              await c.query(
                `WITH visits AS (${visits}) SELECT COALESCE(sum(price_minor) FILTER(WHERE status='completed'),0) value FROM visits`,
                params,
              )
            ).rows[0];
            // Allocate actual net payments by this service's share of invoice line value.
            const cash = (
              await c.query(
                `WITH shares AS (SELECT o.id,COALESCE(sum(oi.quantity*oi.price_minor) FILTER(WHERE oi.service_id=$2),0)::numeric / NULLIF(sum(oi.quantity*oi.price_minor),0)*(o.total_minor-o.tip_minor)::numeric/NULLIF(o.total_minor,0) share FROM orders o JOIN order_items oi ON oi.order_id=o.id AND oi.tenant_id=o.tenant_id WHERE o.tenant_id=$1 AND o.status<>'void' AND ($3::uuid IS NULL OR o.branch_id=$3) GROUP BY o.id), ledger AS (SELECT p.order_id,p.amount_minor amount FROM payments p WHERE p.tenant_id=$1 UNION ALL SELECT p.order_id,-r.amount_minor FROM refunds r JOIN payments p ON p.id=r.payment_id AND p.tenant_id=r.tenant_id WHERE r.tenant_id=$1) SELECT COALESCE(round(sum(l.amount*s.share)),0) net_minor FROM shares s JOIN ledger l ON l.order_id=s.id`,
                params,
              )
            ).rows[0];
            financial = {
              completed_value_minor: Number(completed.value),
              net_collected_minor: Number(cash.net_minor),
            };
          }
          return {
            service,
            attendance,
            financial,
            monthly: monthly.map((row) => ({
              month: row.month_label,
              completed: row.completed,
              ...(financeAllowed
                ? { completed_value_minor: Number(row.completed_value_minor) }
                : {}),
            })),
          };
        }),
      );
    }),
  );
}
