import type express from "express";
import { z } from "zod";
import { scoped, audit } from "../db.js";
import { wrap, ok, tenantContext, feature } from "../runtime.js";
import { HttpError } from "../security.js";
import { sameBranch } from "../services/inventory.js";
import { canViewEmployeeSalary } from "../services/employee-access.js";
const uuid = z.string().uuid();
export function register(app: express.Express) {
  app.get(
    "/api/v1/settings",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "settings.manage");
      ok(
        res,
        await scoped(
          s.tenant_id,
          async (c) =>
            (await c.query("SELECT * FROM tenants WHERE id=$1", [s.tenant_id]))
              .rows[0],
        ),
      );
    }),
  );
  app.patch(
    "/api/v1/settings",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "settings.manage");
      const d = z
        .object({
          name: z.string().min(2).max(100).optional(),
          currency_change_confirmed: z.boolean().optional(),
          currency: z
            .string()
            .length(3)
            .refine((v) => {
              try {
                const format = new Intl.NumberFormat("en", {
                  style: "currency",
                  currency: v,
                });
                return (
                  Intl.supportedValuesOf("currency").includes(v) &&
                  format.resolvedOptions().maximumFractionDigits === 2
                );
              } catch {
                return false;
              }
            })
            .optional(),
          timezone: z
            .string()
            .refine((v) => {
              try {
                new Intl.DateTimeFormat("en", { timeZone: v });
                return true;
              } catch {
                return false;
              }
            })
            .optional(),
          contact_email: z.string().email().nullable().optional(),
          phone: z.string().max(40).nullable().optional(),
          address: z.string().max(1000).optional(),
          booking_min_hours: z.number().int().min(0).max(720).optional(),
          booking_max_days: z.number().int().min(1).max(730).optional(),
          cancel_hours: z.number().int().min(0).max(720).optional(),
          tax_basis_points: z.number().int().min(0).max(10000).optional(),
          brand_color: z
            .string()
            .regex(/^#[\da-fA-F]{6}$/)
            .optional(),
        })
        .parse(req.body);
      const { currency_change_confirmed, ...settings } = d;
      const keys = Object.keys(settings);
      if (!keys.length) throw new HttpError(422, "No settings provided");
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const previous = (
            await c.query(
              "SELECT currency FROM tenants WHERE id=$1 FOR UPDATE",
              [s.tenant_id],
            )
          ).rows[0];
          if (
            d.currency &&
            d.currency !== previous.currency &&
            !currency_change_confirmed
          )
            throw new HttpError(
              409,
              "Changing currency relabels all existing amounts in the new currency. No exchange rate will be applied. Confirm this change to continue.",
            );
          if (d.currency && d.currency !== previous.currency)
            await c.query(
              "INSERT INTO audit_logs(actor_id,tenant_id,action,target_id,metadata) VALUES($1,$2::uuid,'settings.currency_changed',$2::text,$3::jsonb)",
              [
                s.user_id,
                s.tenant_id,
                JSON.stringify({
                  from: previous.currency,
                  to: d.currency,
                  exchange_rate_applied: false,
                }),
              ],
            );
          const r = (
            await c.query(
              `UPDATE tenants SET ${keys.map((k, i) => k + "=$" + (i + 2)).join(",")},updated_at=now() WHERE id=$1 RETURNING *`,
              [s.tenant_id, ...Object.values(settings)],
            )
          ).rows[0];
          await audit(
            c,
            s.user_id,
            s.tenant_id,
            "settings.updated",
            s.tenant_id,
          );
          return r;
        }),
      );
    }),
  );
  app.post(
    "/api/v1/branches",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "settings.manage");
      if (s.branch_id)
        throw new HttpError(403, "Organization-wide access required");
      const d = z
        .object({
          name: z.string().min(2).max(100),
          address: z.string().max(1000).default(""),
        })
        .parse(req.body);
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const limit = (
            await c.query(
              "SELECT max_locations FROM tenants WHERE id=$1 FOR UPDATE",
              [s.tenant_id],
            )
          ).rows[0].max_locations;
          const used = Number(
            (
              await c.query(
                "SELECT count(*) FROM branches WHERE tenant_id=$1",
                [s.tenant_id],
              )
            ).rows[0].count,
          );
          if (used >= limit)
            throw new HttpError(
              403,
              "Your shop has reached its location limit. Ask the platform administrator to increase it.",
            );
          const row = (
            await c.query(
              "INSERT INTO branches(tenant_id,name,address) VALUES($1,$2,$3) RETURNING *",
              [s.tenant_id, d.name, d.address],
            )
          ).rows[0];
          await audit(c, s.user_id, s.tenant_id, "branch.created", row.id);
          return row;
        }),
        201,
      );
    }),
  );
  app.patch(
    "/api/v1/features/:key",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "features.manage");
      const key = z.string().max(80).parse(req.params.key),
        d = z.object({ enabled: z.boolean() }).parse(req.body);
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const f = (
            await c.query("SELECT * FROM features WHERE key=$1", [key])
          ).rows[0];
          if (!f) throw new HttpError(404, "Feature not found");
          const restriction = (
            await c.query(
              "SELECT admin_enabled FROM tenant_features WHERE tenant_id=$1 AND feature_key=$2",
              [s.tenant_id, key],
            )
          ).rows[0];
          if (d.enabled && restriction?.admin_enabled === false)
            throw new HttpError(
              403,
              "The platform administrator has disabled this module for your shop",
            );
          if (d.enabled && (!f.enabled || !f.allowed_plans.includes(s.plan)))
            throw new HttpError(
              403,
              "Platform or plan does not permit this feature",
            );
          if (d.enabled && f.dependency)
            await feature(s.tenant_id, f.dependency, s.plan);
          const row = (
            await c.query(
              "INSERT INTO tenant_features(tenant_id,feature_key,enabled) VALUES($1,$2,$3) ON CONFLICT(tenant_id,feature_key) DO UPDATE SET enabled=$3 RETURNING *",
              [s.tenant_id, key, d.enabled],
            )
          ).rows[0];
          await audit(c, s.user_id, s.tenant_id, "tenant.feature.updated", key);
          return row;
        }),
      );
    }),
  );
  const editSchemas = {
    customers: z.object({
      name: z.string().min(2).max(120).optional(),
      email: z.string().email().nullable().optional(),
      phone: z.string().max(40).optional(),
      notes: z.string().max(5000).optional(),
      marketing_consent: z.boolean().optional(),
      birthday: z.string().date().nullable().optional(),
      preferred_channel: z
        .enum(["email", "sms", "whatsapp", "none"])
        .optional(),
      tags: z.array(z.string().max(40)).max(20).optional(),
    }),
    employees: z.object({
      name: z.string().min(2).max(120).optional(),
      title: z.string().max(100).optional(),
      email: z.string().trim().email().max(254).optional(),
      phone: z
        .string()
        .trim()
        .regex(/^[+\d\s().-]{5,40}$/)
        .optional(),
      base_salary_minor: z.number().int().min(0).max(1000000000).optional(),
      commission_basis_points: z.number().int().min(0).max(10000).optional(),
      active: z.boolean().optional(),
    }),
    services: z.object({
      name: z.string().min(2).max(120).optional(),
      duration_minutes: z.number().int().min(5).max(600).optional(),
      buffer_minutes: z.number().int().min(0).max(120).optional(),
      price_minor: z.number().int().min(0).max(100000000).optional(),
      active: z.boolean().optional(),
    }),
  };
  for (const [module, schema] of Object.entries(editSchemas)) {
    app.patch(
      "/api/v1/" + module + "/:id",
      wrap(async (req, res) => {
        const s = await tenantContext(req, module + ".write");
        await feature(s.tenant_id, module, s.plan);
        const id = uuid.parse(req.params.id),
          d = schema.parse(req.body) as Record<string, unknown>,
          keys = Object.keys(d);
        if (
          module === "employees" &&
          ("commission_basis_points" in d || "base_salary_minor" in d) &&
          !s.is_owner
        )
          await tenantContext(req, "payroll.write");
        if (!keys.length) throw new HttpError(422, "No changes provided");
        const salaryVisible =
          module === "employees" &&
          (await canViewEmployeeSalary(req, s.is_owner));
        ok(
          res,
          await scoped(s.tenant_id, async (c) => {
            const r = (
              await c.query(
                `SELECT * FROM ${module} WHERE tenant_id=$1 AND id=$2 FOR UPDATE`,
                [s.tenant_id, id],
              )
            ).rows[0];
            if (!r) throw new HttpError(404, "Record not found");
            if (r.branch_id) sameBranch(s, r.branch_id);
            const updated = (
              await c.query(
                `UPDATE ${module} SET ${keys.map((k, i) => k + "=$" + (i + 3)).join(",")} WHERE tenant_id=$1 AND id=$2 RETURNING *`,
                [s.tenant_id, id, ...Object.values(d)],
              )
            ).rows[0];
            if (
              module === "customers" &&
              "marketing_consent" in d &&
              r.marketing_consent !== d.marketing_consent
            )
              await c.query(
                "INSERT INTO consent_records(tenant_id,customer_id,purpose,granted,actor_id) VALUES($1,$2,'marketing',$3,$4)",
                [s.tenant_id, id, d.marketing_consent, s.user_id],
              );
            await audit(c, s.user_id, s.tenant_id, module + ".updated", id);
            if (module === "employees" && !salaryVisible)
              delete updated.base_salary_minor;
            return updated;
          }),
        );
      }),
    );
  }
  app.get(
    "/api/v1/customers/:id/history",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "customers.read");
      await feature(s.tenant_id, "customers", s.plan);
      const id = uuid.parse(req.params.id);
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const customer = (
            await c.query(
              "SELECT * FROM customers WHERE tenant_id=$1 AND id=$2 AND deleted_at IS NULL",
              [s.tenant_id, id],
            )
          ).rows[0];
          if (!customer) throw new HttpError(404, "Customer not found");
          const appointments = (
            await c.query(
              "SELECT a.*,e.name employee_name FROM appointments a JOIN employees e ON e.id=a.employee_id AND e.tenant_id=a.tenant_id WHERE a.tenant_id=$1 AND a.customer_id=$2 AND ($3::uuid IS NULL OR a.branch_id=$3) ORDER BY starts_at DESC LIMIT 100",
              [s.tenant_id, id, s.branch_id],
            )
          ).rows;
          const consent = (
            await c.query(
              "SELECT purpose,granted,created_at FROM consent_records WHERE tenant_id=$1 AND customer_id=$2 ORDER BY created_at DESC",
              [s.tenant_id, id],
            )
          ).rows;
          return { customer, appointments, consent };
        }),
      );
    }),
  );
  app.get(
    "/api/v1/analytics/appointments",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "finance.read");
      await tenantContext(req, "appointments.read");
      await feature(s.tenant_id, "analytics", s.plan);
      const d = z
        .object({
          from: z.string().date(),
          to: z.string().date(),
          status: z.enum([
            "pending",
            "confirmed",
            "checked_in",
            "in_progress",
            "completed",
            "cancelled",
            "no_show",
            "rescheduled",
          ]),
          page: z.coerce.number().int().min(1).max(10000).default(1),
        })
        .parse(req.query);
      if (d.to < d.from) throw new HttpError(422, "Invalid date range");
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const args = [
            s.tenant_id,
            d.from,
            d.to,
            s.branch_id || null,
            d.status,
          ];
          const where =
            "a.tenant_id=$1 AND a.starts_at >= $2::date AND a.starts_at < $3::date+interval '1 day' AND ($4::uuid IS NULL OR a.branch_id=$4) AND a.status=$5";
          const total = Number(
            (
              await c.query(
                `SELECT count(*) FROM appointments a WHERE ${where}`,
                args,
              )
            ).rows[0].count,
          );
          const items = (
            await c.query(
              `SELECT a.id,a.status,to_char(a.starts_at,'YYYY-MM-DD HH24:MI') starts_local,to_char(a.ends_at,'YYYY-MM-DD HH24:MI') ends_local,cu.name customer_name,e.name employee_name,b.name branch_name,COALESCE((SELECT string_agg(sv.name,', ') FROM appointment_services aps JOIN services sv ON sv.tenant_id=aps.tenant_id AND sv.id=aps.service_id WHERE aps.tenant_id=a.tenant_id AND aps.appointment_id=a.id),'Appointment') services FROM appointments a JOIN customers cu ON cu.tenant_id=a.tenant_id AND cu.id=a.customer_id JOIN employees e ON e.tenant_id=a.tenant_id AND e.id=a.employee_id JOIN branches b ON b.tenant_id=a.tenant_id AND b.id=a.branch_id WHERE ${where} ORDER BY a.starts_at DESC,a.id LIMIT 25 OFFSET $6`,
              [...args, (d.page - 1) * 25],
            )
          ).rows;
          return { items, total, page: d.page };
        }),
      );
    }),
  );
  app.get(
    "/api/v1/analytics",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "finance.read");
      await feature(s.tenant_id, "analytics", s.plan);
      const d = z
        .object({
          from: z.string().date(),
          to: z.string().date(),
          branch_id: uuid.optional(),
        })
        .parse(req.query);
      if (d.branch_id) sameBranch(s, d.branch_id);
      if (d.to < d.from) throw new HttpError(422, "Invalid date range");
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const args = [
            s.tenant_id,
            d.from,
            d.to,
            s.branch_id || d.branch_id || null,
          ];
          const payments = (
            await c.query(
              `SELECT COALESCE(sum(p.amount_minor),0) total FROM payments p JOIN orders o ON o.id=p.order_id AND o.tenant_id=p.tenant_id WHERE p.tenant_id=$1 AND p.created_at>=$2::date AND p.created_at<($3::date+interval '1 day') AND ($4::uuid IS NULL OR o.branch_id=$4)`,
              args,
            )
          ).rows[0];
          const refunds = (
            await c.query(
              `SELECT COALESCE(sum(r.amount_minor),0) total FROM refunds r JOIN payments p ON p.id=r.payment_id AND p.tenant_id=r.tenant_id JOIN orders o ON o.id=p.order_id AND o.tenant_id=p.tenant_id WHERE r.tenant_id=$1 AND r.created_at>=$2::date AND r.created_at<($3::date+interval '1 day') AND ($4::uuid IS NULL OR o.branch_id=$4)`,
              args,
            )
          ).rows[0];
          const bookings = (
            await c.query(
              `SELECT status,count(*)::integer count FROM appointments WHERE tenant_id=$1 AND starts_at>=$2::date AND starts_at<($3::date+interval '1 day') AND ($4::uuid IS NULL OR branch_id=$4) GROUP BY status`,
              args,
            )
          ).rows;
          const series = (
            await c.query(
              `SELECT p.created_at::date AS "day",sum(p.amount_minor) revenue_minor FROM payments p JOIN orders o ON o.id=p.order_id AND o.tenant_id=p.tenant_id WHERE p.tenant_id=$1 AND p.created_at>=$2::date AND p.created_at<($3::date+interval '1 day') AND ($4::uuid IS NULL OR o.branch_id=$4) GROUP BY 1 ORDER BY 1`,
              args,
            )
          ).rows;
          return {
            gross_minor: Number(payments.total),
            refunds_minor: Number(refunds.total),
            net_minor: Number(payments.total) - Number(refunds.total),
            bookings,
            series,
          };
        }),
      );
    }),
  );
}
