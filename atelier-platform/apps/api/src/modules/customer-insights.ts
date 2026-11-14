import type express from "express";
import { z } from "zod";
import { scoped } from "../db.js";
import { wrap, ok, tenantContext, feature } from "../runtime.js";
import { HttpError } from "../security.js";
export function register(app: express.Express) {
  app.get(
    "/api/v1/customers/:id/insights",
    wrap(async (req, res) => {
      const session = await tenantContext(req, "customers.read");
      await feature(session.tenant_id, "customers", session.plan);
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
      const result = await scoped(session.tenant_id, async (c) => {
        if (
          !(
            await c.query(
              "SELECT 1 FROM customers WHERE tenant_id=$1 AND id=$2 AND deleted_at IS NULL",
              [session.tenant_id, id],
            )
          ).rowCount
        )
          throw new HttpError(404, "Customer not found");
        const parameters = [session.tenant_id, id, session.branch_id];
        const attendance = (
          await c.query(
            "WITH visits AS (SELECT status,starts_at FROM appointments WHERE tenant_id=$1 AND customer_id=$2 AND ($3::uuid IS NULL OR branch_id=$3) UNION ALL SELECT 'completed',created_at FROM quick_work_visits WHERE tenant_id=$1 AND customer_id=$2 AND ($3::uuid IS NULL OR branch_id=$3)) SELECT count(*) FILTER(WHERE status='completed')::integer completed,count(*) FILTER(WHERE status='no_show')::integer no_show,count(*) FILTER(WHERE status='cancelled')::integer cancelled,count(*) FILTER(WHERE starts_at>=now() AND status NOT IN ('completed','cancelled','no_show','rescheduled'))::integer upcoming FROM visits",
            parameters,
          )
        ).rows[0];
        if (!financeAllowed) return { attendance, financial: null };
        const ledger =
          "SELECT p.amount_minor amount,p.created_at,p.amount_minor::numeric*o.tip_minor/NULLIF(o.total_minor,0) tip_amount FROM payments p JOIN orders o ON o.id=p.order_id AND o.tenant_id=p.tenant_id WHERE o.tenant_id=$1 AND o.customer_id=$2 AND ($3::uuid IS NULL OR o.branch_id=$3) UNION ALL SELECT -r.amount_minor amount,r.created_at,-r.amount_minor::numeric*o.tip_minor/NULLIF(o.total_minor,0) tip_amount FROM refunds r JOIN payments p ON p.id=r.payment_id AND p.tenant_id=r.tenant_id JOIN orders o ON o.id=p.order_id AND o.tenant_id=p.tenant_id WHERE o.tenant_id=$1 AND o.customer_id=$2 AND ($3::uuid IS NULL OR o.branch_id=$3)";
        const cash = (
          await c.query(
            "WITH ledger AS (" +
              ledger +
              ") SELECT COALESCE(sum(amount),0) net_collected_minor,COALESCE(sum(amount) FILTER(WHERE amount>0),0) collected_minor,-COALESCE(sum(amount) FILTER(WHERE amount<0),0) refunded_minor,COALESCE(round(sum(tip_amount)),0) net_tip_minor FROM ledger",
            parameters,
          )
        ).rows[0];
        const costs = (
          await c.query(
            "SELECT COALESCE((SELECT sum(oi.quantity*p.cost_minor) FROM order_items oi JOIN orders o ON o.id=oi.order_id AND o.tenant_id=oi.tenant_id JOIN products p ON p.id=oi.product_id AND p.tenant_id=oi.tenant_id WHERE o.tenant_id=$1 AND o.customer_id=$2 AND o.status<>'void' AND ($3::uuid IS NULL OR o.branch_id=$3)),0)+COALESCE((SELECT sum(-m.quantity*p.cost_minor) FROM inventory_movements m LEFT JOIN appointments a ON a.id=m.reference_id AND a.tenant_id=m.tenant_id LEFT JOIN quick_work_visits v ON v.id=m.reference_id AND v.tenant_id=m.tenant_id JOIN products p ON p.id=m.product_id AND p.tenant_id=m.tenant_id WHERE m.tenant_id=$1 AND COALESCE(a.customer_id,v.customer_id)=$2 AND m.reason='service_consumption' AND ($3::uuid IS NULL OR COALESCE(a.branch_id,v.branch_id)=$3)),0)+COALESCE((SELECT sum(co.amount_minor) FROM commissions co LEFT JOIN appointments a ON a.id=co.appointment_id AND a.tenant_id=co.tenant_id LEFT JOIN quick_work_visits v ON v.id=co.quick_visit_id AND v.tenant_id=co.tenant_id WHERE co.tenant_id=$1 AND COALESCE(a.customer_id,v.customer_id)=$2 AND ($3::uuid IS NULL OR COALESCE(a.branch_id,v.branch_id)=$3)),0) known_cost_minor",
            parameters,
          )
        ).rows[0];
        const monthly = (
          await c.query(
            "WITH ledger AS (" +
              ledger +
              "),months AS (SELECT generate_series(date_trunc('month',now())-interval '5 months',date_trunc('month',now()),interval '1 month') AS month_start) SELECT to_char(months.month_start,'Mon YY') AS month_label,COALESCE(sum(ledger.amount),0) net_minor FROM months LEFT JOIN ledger ON date_trunc('month',ledger.created_at)=months.month_start GROUP BY months.month_start ORDER BY months.month_start",
            parameters,
          )
        ).rows;
        const net = Math.round(Number(cash.net_collected_minor)),
          known =
            Math.round(Number(costs.known_cost_minor)) +
            Number(cash.net_tip_minor);
        return {
          attendance,
          financial: {
            ...cash,
            net_collected_minor: net,
            known_cost_minor: known,
            contribution_minor: net - known,
            monthly: monthly.map((row) => ({
              month: row.month_label,
              net_minor: Number(row.net_minor),
            })),
          },
        };
      });
      ok(res, result);
    }),
  );
}
