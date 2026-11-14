import type express from "express";
import { z } from "zod";
import { scoped } from "../db.js";
import { wrap, ok, tenantContext, feature } from "../runtime.js";
import { HttpError } from "../security.js";
import { sameBranch } from "../services/inventory.js";
export function register(app: express.Express) {
  app.get(
    "/api/v1/bookings/options",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "appointments.read");
      await feature(s.tenant_id, "appointments", s.plan);
      let payment = false;
      try {
        await tenantContext(req, "finance.write");
        await feature(s.tenant_id, "pos", s.plan);
        payment = true;
      } catch (error) {
        if (!(error instanceof HttpError && error.status === 403)) throw error;
      }
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const settings = (
            await c.query(
              "SELECT currency,timezone,tax_basis_points,payment_methods,to_char(now(),'YYYY-MM-DD') today FROM tenants WHERE id=$1",
              [s.tenant_id],
            )
          ).rows[0];
          return {
            ...settings,
            can_record_payment: payment,
            branches: (
              await c.query(
                "SELECT id,name FROM branches WHERE tenant_id=$1 AND active AND ($2::uuid IS NULL OR id=$2) ORDER BY name",
                [s.tenant_id, s.branch_id],
              )
            ).rows,
            services: (
              await c.query(
                "SELECT id,name,price_minor,duration_minutes FROM services WHERE tenant_id=$1 AND active ORDER BY name LIMIT 1000",
                [s.tenant_id],
              )
            ).rows,
          };
        }),
      );
    }),
  );
  app.get(
    "/api/v1/bookings",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "appointments.read");
      await feature(s.tenant_id, "appointments", s.plan);
      const d = z
        .object({
          from: z.string().date().optional(),
          to: z.string().date().optional(),
          range: z.enum(["date", "all"]).default("date"),
          q: z.string().max(100).default(""),
          status: z
            .enum([
              "all",
              "pending",
              "confirmed",
              "checked_in",
              "in_progress",
              "completed",
              "cancelled",
              "no_show",
              "rescheduled",
            ])
            .default("all"),
          kind: z.enum(["all", "booking", "walkin"]).default("all"),
          branch_id: z.string().uuid().optional(),
          page: z.coerce.number().int().min(1).max(10000).default(1),
        })
        .parse(req.query);
      if (d.branch_id) sameBranch(s, d.branch_id);
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const settings = (
            await c.query(
              "SELECT timezone,to_char(now(),'YYYY-MM-DD') today FROM tenants WHERE id=$1",
              [s.tenant_id],
            )
          ).rows[0];
          const from = d.from || settings.today,
            to = d.to || from;
          if (to < from)
            throw new HttpError(
              422,
              "Choose an end date on or after the start date.",
            );
          const args = [
            s.tenant_id,
            s.branch_id || d.branch_id || null,
            d.range === "all" ? null : from,
            d.range === "all" ? null : to,
            d.q,
            d.status,
            d.kind,
          ];
          const source = `WITH visits AS (
        SELECT a.id,'booking' kind,a.starts_at,a.ends_at,a.status,a.customer_id,a.employee_id,a.branch_id,a.paid_in_advance,a.notes,o.id order_id,COALESCE((SELECT json_agg(json_build_object('id',aps.service_id,'name',sv.name,'price_minor',aps.price_minor,'duration_minutes',aps.duration_minutes)) FROM appointment_services aps JOIN services sv ON sv.tenant_id=aps.tenant_id AND sv.id=aps.service_id WHERE aps.tenant_id=a.tenant_id AND aps.appointment_id=a.id),'[]') services FROM appointments a LEFT JOIN orders o ON o.tenant_id=a.tenant_id AND o.appointment_id=a.id WHERE a.tenant_id=$1
        UNION ALL SELECT v.id,'walkin',v.created_at,v.created_at,'completed',v.customer_id,v.employee_id,v.branch_id,false,''::text,v.order_id,COALESCE((SELECT json_agg(json_build_object('id',qs.service_id,'name',qs.name,'price_minor',qs.price_minor)) FROM quick_work_services qs WHERE qs.tenant_id=v.tenant_id AND qs.visit_id=v.id),'[]') FROM quick_work_visits v WHERE v.tenant_id=$1
      ), selected AS (SELECT v.*,to_char(v.starts_at,'YYYY-MM-DD HH24:MI') starts_local,cu.name customer_name,e.name employee_name,e.image_version,b.name branch_name FROM visits v JOIN customers cu ON cu.tenant_id=$1 AND cu.id=v.customer_id JOIN employees e ON e.tenant_id=$1 AND e.id=v.employee_id JOIN branches b ON b.tenant_id=$1 AND b.id=v.branch_id WHERE ($2::uuid IS NULL OR v.branch_id=$2) AND ($3::date IS NULL OR v.starts_at >=$3::date) AND ($4::date IS NULL OR v.starts_at<$4::date+interval '1 day') AND ($5='' OR cu.name ILIKE '%'||$5||'%' OR e.name ILIKE '%'||$5||'%' OR b.name ILIKE '%'||$5||'%') AND ($6='all' OR v.status=$6) AND ($7='all' OR v.kind=$7))`;
          const summary = (
            await c.query(
              source +
                ` SELECT count(*)::int total,count(*) FILTER(WHERE kind='booking')::int scheduled,count(*) FILTER(WHERE kind='walkin')::int walkins,count(*) FILTER(WHERE status='completed')::int completed FROM selected`,
              args,
            )
          ).rows[0];
          const items = (
            await c.query(
              source +
                " SELECT * FROM selected ORDER BY starts_at DESC,kind,id LIMIT 25 OFFSET $8",
              [...args, (d.page - 1) * 25],
            )
          ).rows;
          return {
            items,
            ...summary,
            page: d.page,
            from,
            to,
            range: d.range,
            ...settings,
          };
        }),
      );
    }),
  );
}
