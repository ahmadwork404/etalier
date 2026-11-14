import express from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { scoped, audit } from "../db.js";
import { wrap, ok, tenantContext, feature } from "../runtime.js";
import { HttpError } from "../security.js";
import { sameBranch } from "../services/inventory.js";
import { validServiceImage } from "../services/service-image.js";
import { canViewEmployeeSalary } from "../services/employee-access.js";
const uuid = z.string().uuid(),
  time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
async function context(req: express.Request, write = false) {
  const s = await tenantContext(
    req,
    write ? "employees.write" : "employees.read",
  );
  await feature(s.tenant_id, "employees", s.plan);
  return s;
}
async function photoContext(req: express.Request) {
  try {
    return await context(req);
  } catch (error) {
    if (!(error instanceof HttpError && error.status === 403)) throw error;
  }
  for (const permission of ["payroll.read", "payroll.write"])
    try {
      const s = await tenantContext(req, permission);
      await feature(s.tenant_id, "employees", s.plan);
      return s;
    } catch (error) {
      if (!(error instanceof HttpError && error.status === 403)) throw error;
    }
  throw new HttpError(403, "Employee photo access required");
}
export function register(app: express.Express) {
  app.get(
    "/api/v1/employee-profiles/:id",
    wrap(async (req, res) => {
      const s = await context(req),
        id = uuid.parse(req.params.id);
      const month = z
        .string()
        .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
        .refine(
          (value) => Number(value.slice(0, 4)) > 0,
          "Choose a valid calendar month",
        )
        .parse(req.query.month || new Date().toISOString().slice(0, 7));
      let finance = false;
      const compensation = await canViewEmployeeSalary(req, s.is_owner);
      try {
        await tenantContext(req, "finance.read");
        await feature(s.tenant_id, "pos", s.plan);
        finance = true;
      } catch (error) {
        if (!(error instanceof HttpError && error.status === 403)) throw error;
      }
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const employee = (
            await c.query(
              "SELECT e.*,b.name branch_name,t.timezone FROM employees e JOIN branches b ON b.id=e.branch_id AND b.tenant_id=e.tenant_id JOIN tenants t ON t.id=e.tenant_id WHERE e.tenant_id=$1 AND e.id=$2",
              [s.tenant_id, id],
            )
          ).rows[0];
          if (!employee) throw new HttpError(404, "Employee not found");
          sameBranch(s, employee.branch_id);
          const args = [s.tenant_id, id, month + "-01"];
          const hours = (
            await c.query(
              "SELECT weekday,to_char(opens_at,'HH24:MI') opens_at,to_char(closes_at,'HH24:MI') closes_at FROM employee_schedules WHERE tenant_id=$1 AND employee_id=$2 ORDER BY weekday",
              [s.tenant_id, id],
            )
          ).rows;
          const leaves = (
            await c.query(
              "SELECT id,starts_at,ends_at,reason,paid,to_char(starts_at,'YYYY-MM-DD HH24:MI') starts_local,to_char(ends_at,'YYYY-MM-DD HH24:MI') ends_local FROM employee_leaves WHERE tenant_id=$1 AND employee_id=$2 AND starts_at<($3::date+interval '1 month') AND ends_at>$3::date ORDER BY starts_at",
              args,
            )
          ).rows;
          const appointments = (
            await c.query(
              "SELECT a.id,a.status,a.starts_at,a.ends_at,to_char(a.starts_at,'YYYY-MM-DD HH24:MI') starts_local,to_char(a.ends_at,'YYYY-MM-DD HH24:MI') ends_local,cu.name customer_name,COALESCE((SELECT string_agg(sv.name,', ') FROM appointment_services aps JOIN services sv ON sv.id=aps.service_id AND sv.tenant_id=aps.tenant_id WHERE aps.tenant_id=a.tenant_id AND aps.appointment_id=a.id),'Appointment') services FROM appointments a JOIN customers cu ON cu.id=a.customer_id AND cu.tenant_id=a.tenant_id WHERE a.tenant_id=$1 AND a.employee_id=$2 AND starts_at>= $3::date AND starts_at<($3::date+interval '1 month') ORDER BY starts_at",
              args,
            )
          ).rows;
          const attendance = (
            await c.query(
              "WITH visits AS (SELECT status,customer_id FROM appointments WHERE tenant_id=$1 AND employee_id=$2 AND starts_at>=$3::date AND starts_at<($3::date+interval '1 month') UNION ALL SELECT 'completed',customer_id FROM quick_work_visits WHERE tenant_id=$1 AND employee_id=$2 AND created_at>=$3::date AND created_at<($3::date+interval '1 month')) SELECT count(*)::integer bookings,count(*) FILTER(WHERE status='completed')::integer completed,count(*) FILTER(WHERE status='cancelled')::integer cancelled,count(*) FILTER(WHERE status='no_show')::integer no_show,count(DISTINCT customer_id) FILTER(WHERE status='completed')::integer customers FROM visits",
              args,
            )
          ).rows[0];
          let financial = null,
            payroll = null;
          if (finance) {
            const value = (
              await c.query(
                "SELECT COALESCE(sum(value),0) total FROM (SELECT aps.price_minor value FROM appointment_services aps JOIN appointments a ON a.id=aps.appointment_id AND a.tenant_id=aps.tenant_id WHERE a.tenant_id=$1 AND a.employee_id=$2 AND a.status='completed' AND a.starts_at>=$3::date AND a.starts_at<($3::date+interval '1 month') UNION ALL SELECT qs.price_minor FROM quick_work_services qs JOIN quick_work_visits v ON v.tenant_id=qs.tenant_id AND v.id=qs.visit_id WHERE v.tenant_id=$1 AND v.employee_id=$2 AND v.created_at>=$3::date AND v.created_at<($3::date+interval '1 month')) values_recorded",
                args,
              )
            ).rows[0];
            const cash = (
              await c.query(
                "WITH shares AS (SELECT o.id,COALESCE(sum(oi.quantity*oi.price_minor) FILTER(WHERE oi.service_id IS NOT NULL OR oi.custom),0)::numeric/NULLIF(sum(oi.quantity*oi.price_minor),0)*(o.total_minor-o.tip_minor)::numeric/NULLIF(o.total_minor,0) share FROM orders o LEFT JOIN appointments a ON a.tenant_id=o.tenant_id AND a.id=o.appointment_id JOIN order_items oi ON oi.tenant_id=o.tenant_id AND oi.order_id=o.id WHERE o.tenant_id=$1 AND COALESCE(o.employee_id,a.employee_id)=$2 AND o.status<>'void' GROUP BY o.id),ledger AS (SELECT p.order_id,p.amount_minor amount,p.created_at FROM payments p WHERE p.tenant_id=$1 UNION ALL SELECT p.order_id,-r.amount_minor,r.created_at FROM refunds r JOIN payments p ON p.id=r.payment_id AND p.tenant_id=r.tenant_id WHERE r.tenant_id=$1) SELECT COALESCE(round(sum(l.amount*s.share)),0) total FROM shares s JOIN ledger l ON l.order_id=s.id WHERE l.created_at>=$3::date AND l.created_at<($3::date+interval '1 month')",
                args,
              )
            ).rows[0];
            const consumables = (
              await c.query(
                "SELECT COALESCE(sum(-m.quantity*p.cost_minor),0) total FROM inventory_movements m LEFT JOIN appointments a ON a.id=m.reference_id AND a.tenant_id=m.tenant_id LEFT JOIN quick_work_visits v ON v.id=m.reference_id AND v.tenant_id=m.tenant_id JOIN products p ON p.id=m.product_id AND p.tenant_id=m.tenant_id WHERE m.tenant_id=$1 AND COALESCE(a.employee_id,v.employee_id)=$2 AND m.reason='service_consumption' AND COALESCE(a.starts_at,v.created_at)>=$3::date AND COALESCE(a.starts_at,v.created_at)<($3::date+interval '1 month')",
                args,
              )
            ).rows[0];
            const daily = (
              await c.query(
                "SELECT to_char(work_time,'DD') AS day_label,sum(value) value_minor FROM (SELECT a.starts_at work_time,aps.price_minor value FROM appointments a JOIN appointment_services aps ON aps.tenant_id=a.tenant_id AND aps.appointment_id=a.id WHERE a.tenant_id=$1 AND a.employee_id=$2 AND a.status='completed' AND a.starts_at>=$3::date AND a.starts_at<($3::date+interval '1 month') UNION ALL SELECT v.created_at,qs.price_minor FROM quick_work_visits v JOIN quick_work_services qs ON qs.tenant_id=v.tenant_id AND qs.visit_id=v.id WHERE v.tenant_id=$1 AND v.employee_id=$2 AND v.created_at>=$3::date AND v.created_at<($3::date+interval '1 month')) works GROUP BY 1 ORDER BY 1",
                args,
              )
            ).rows.map((row) => ({
              day: row.day_label,
              value_minor: Number(row.value_minor),
            }));
            financial = {
              completed_value_minor: Number(value.total),
              net_collected_minor: Number(cash.total),
              consumables_minor: Number(consumables.total),
              daily,
              contribution_minor: null as number | null,
            };
          }
          if (compensation) {
            const commission = (
              await c.query(
                "SELECT COALESCE(sum(co.amount_minor),0) total FROM commissions co LEFT JOIN appointments a ON a.id=co.appointment_id AND a.tenant_id=co.tenant_id LEFT JOIN quick_work_visits v ON v.id=co.quick_visit_id AND v.tenant_id=co.tenant_id WHERE co.tenant_id=$1 AND co.employee_id=$2 AND COALESCE(a.starts_at,v.created_at)>=$3::date AND COALESCE(a.starts_at,v.created_at)<($3::date+interval '1 month')",
                args,
              )
            ).rows[0];
            const records = (
              await c.query(
                "SELECT id,period_start::text,period_end::text,base_minor,commission_minor,unpaid_leave_minor,bonus_minor,deduction_minor,status,paid_at FROM payroll_records WHERE tenant_id=$1 AND employee_id=$2 AND period_start<($3::date+interval '1 month') AND period_end>=$3::date ORDER BY period_start",
                args,
              )
            ).rows;
            const totals = (
              await c.query(
                "SELECT COALESCE(round(sum((base_minor+commission_minor+bonus_minor-deduction_minor-unpaid_leave_minor)*((LEAST(period_end,($3::date+interval '1 month'-interval '1 day')::date)-GREATEST(period_start,$3::date)+1)::numeric/(period_end-period_start+1)))),0) recorded_minor,COALESCE(round(sum((base_minor+commission_minor+bonus_minor-deduction_minor-unpaid_leave_minor)*((LEAST(period_end,($3::date+interval '1 month'-interval '1 day')::date)-GREATEST(period_start,$3::date)+1)::numeric/(period_end-period_start+1))) FILTER(WHERE status='paid')),0) paid_minor FROM payroll_records WHERE tenant_id=$1 AND employee_id=$2 AND period_start<($3::date+interval '1 month') AND period_end>=$3::date",
                args,
              )
            ).rows[0];
            payroll = {
              base_salary_minor: Number(employee.base_salary_minor),
              commission_minor: Number(commission.total),
              recorded_minor: Number(totals.recorded_minor),
              paid_minor: Number(totals.paid_minor),
              records,
            };
            if (financial)
              financial.contribution_minor =
                financial.net_collected_minor -
                payroll.base_salary_minor -
                payroll.commission_minor -
                financial.consumables_minor;
          }
          delete employee.base_salary_minor;
          return {
            employee,
            hours,
            leaves,
            appointments,
            attendance,
            financial,
            payroll,
            month,
            today: (await c.query("SELECT to_char(now(),'YYYY-MM-DD') today"))
              .rows[0].today,
          };
        }),
      );
    }),
  );
  app.put(
    "/api/v1/employee-profiles/:id/hours",
    wrap(async (req, res) => {
      const s = await context(req, true),
        id = uuid.parse(req.params.id);
      const { days } = z
        .object({
          days: z
            .array(
              z
                .object({
                  weekday: z.number().int().min(0).max(6),
                  opens_at: time,
                  closes_at: time,
                })
                .strict()
                .refine(
                  (day) => day.closes_at > day.opens_at,
                  "Closing time must be after opening time",
                ),
            )
            .max(7)
            .refine(
              (days) =>
                new Set(days.map((day) => day.weekday)).size === days.length,
              "Choose each weekday once",
            ),
        })
        .strict()
        .parse(req.body);
      await scoped(s.tenant_id, async (c) => {
        const employee = (
          await c.query(
            "SELECT branch_id FROM employees WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
            [s.tenant_id, id],
          )
        ).rows[0];
        if (!employee) throw new HttpError(404, "Employee not found");
        sameBranch(s, employee.branch_id);
        const bookings = (
          await c.query(
            "SELECT extract(dow FROM starts_at)::integer weekday,to_char(starts_at,'HH24:MI') starts,to_char(ends_at,'HH24:MI') ends,(starts_at::date=ends_at::date) same_day FROM appointments WHERE tenant_id=$1 AND employee_id=$2 AND starts_at>=now() AND status NOT IN ('completed','cancelled','no_show','rescheduled')",
            [s.tenant_id, id],
          )
        ).rows;
        if (
          bookings.some((booking) => {
            const day = days.find((day) => day.weekday === booking.weekday);
            return (
              !day ||
              !booking.same_day ||
              booking.starts < day.opens_at ||
              booking.ends > day.closes_at
            );
          })
        )
          throw new HttpError(
            409,
            "Some upcoming appointments fall outside these hours. Keep those hours or reschedule the appointments first.",
          );
        await c.query(
          "DELETE FROM employee_schedules WHERE tenant_id=$1 AND employee_id=$2",
          [s.tenant_id, id],
        );
        for (const day of days)
          await c.query(
            "INSERT INTO employee_schedules(tenant_id,employee_id,weekday,opens_at,closes_at) VALUES($1,$2,$3,$4,$5)",
            [s.tenant_id, id, day.weekday, day.opens_at, day.closes_at],
          );
        await audit(c, s.user_id, s.tenant_id, "employee.hours.updated", id);
      });
      ok(res, { saved: true });
    }),
  );
  app.put(
    "/api/v1/employee-profiles/:id/photo",
    (req, res, next) =>
      express.raw({
        type: ["image/jpeg", "image/png", "image/webp"],
        limit: "2mb",
      })(req, res, (error) =>
        next(
          error
            ? new HttpError(
                error.status === 413 ? 413 : 422,
                "Choose a JPG, PNG or WebP image up to 2 MB.",
              )
            : undefined,
        ),
      ),
    wrap(async (req, res) => {
      const s = await context(req, true),
        id = uuid.parse(req.params.id),
        type = req.get("Content-Type")?.split(";")[0] || "";
      if (!Buffer.isBuffer(req.body) || !validServiceImage(req.body, type))
        throw new HttpError(422, "Choose a JPG, PNG or WebP image up to 2 MB.");
      const version = randomUUID();
      await scoped(s.tenant_id, async (c) => {
        const employee = (
          await c.query(
            "SELECT branch_id FROM employees WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
            [s.tenant_id, id],
          )
        ).rows[0];
        if (!employee) throw new HttpError(404, "Employee not found");
        sameBranch(s, employee.branch_id);
        await c.query(
          "INSERT INTO employee_images(tenant_id,employee_id,content_type,data) VALUES($1,$2,$3,$4) ON CONFLICT(tenant_id,employee_id) DO UPDATE SET content_type=EXCLUDED.content_type,data=EXCLUDED.data",
          [s.tenant_id, id, type, req.body],
        );
        await c.query(
          "UPDATE employees SET image_version=$3 WHERE tenant_id=$1 AND id=$2",
          [s.tenant_id, id, version],
        );
        await audit(c, s.user_id, s.tenant_id, "employee.photo.updated", id);
      });
      ok(res, { image_version: version });
    }),
  );
  app.get(
    "/api/v1/employee-profiles/:id/photo",
    wrap(async (req, res) => {
      const s = await photoContext(req),
        id = uuid.parse(req.params.id);
      const image = await scoped(
        s.tenant_id,
        async (c) =>
          (
            await c.query(
              "SELECT i.content_type,i.data,e.branch_id FROM employee_images i JOIN employees e ON e.tenant_id=i.tenant_id AND e.id=i.employee_id WHERE i.tenant_id=$1 AND i.employee_id=$2",
              [s.tenant_id, id],
            )
          ).rows[0],
      );
      if (!image) throw new HttpError(404, "Employee photo not found");
      sameBranch(s, image.branch_id);
      res.setHeader("Content-Type", image.content_type);
      res.setHeader("Content-Disposition", "inline");
      res.send(image.data);
    }),
  );
}
