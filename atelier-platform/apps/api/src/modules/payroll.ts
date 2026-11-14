import type express from "express";
import { z } from "zod";
import { scoped, audit } from "../db.js";
import { wrap, ok, tenantContext, feature } from "../runtime.js";
import { HttpError } from "../security.js";
import { sameBranch } from "../services/inventory.js";
import {
  calculatePayroll,
  generatePayroll,
  refreshPayroll,
} from "../services/payroll.js";
import { plainText } from "../services/intake-validation.js";
const uuid = z.string().uuid(),
  frequency = z.enum(["daily", "weekly", "biweekly", "monthly"]);
async function context(req: express.Request, write = false) {
  const s = await tenantContext(req, write ? "payroll.write" : "payroll.read");
  await feature(s.tenant_id, "employees", s.plan);
  return s;
}
export function register(app: express.Express) {
  app.get(
    "/api/v1/employee-options",
    wrap(async (req, res) => {
      let s;
      for (const permission of [
        "employees.read",
        "payroll.read",
        "payroll.write",
      ]) {
        try {
          s = await tenantContext(req, permission);
          break;
        } catch (e) {
          if (!(e instanceof HttpError && e.status === 403)) throw e;
        }
      }
      if (!s) throw new HttpError(403, "Employee access required");
      await feature(s.tenant_id, "employees", s.plan);
      const branch = uuid.optional().parse(req.query.branch_id);
      if (branch) sameBranch(s, branch);
      const q = z.string().max(100).default("").parse(req.query.q),
        id = uuid.optional().parse(req.query.id);
      ok(
        res,
        await scoped(
          s.tenant_id,
          async (c) =>
            (
              await c.query(
                "SELECT e.id,e.name,e.title,e.image_version,e.active,b.name branch_name FROM employees e JOIN branches b ON b.tenant_id=e.tenant_id AND b.id=e.branch_id WHERE e.tenant_id=$1 AND ($2::uuid IS NULL OR e.branch_id=$2) AND (e.active OR e.id=$4::uuid) AND ($4::uuid IS NULL OR e.id=$4) AND ($3='' OR e.name ILIKE '%'||$3||'%' OR e.email ILIKE '%'||$3||'%' OR b.name ILIKE '%'||$3||'%') ORDER BY e.name LIMIT 50",
                [s!.tenant_id, s!.branch_id || branch || null, q, id || null],
              )
            ).rows,
        ),
      );
    }),
  );
  app.get(
    "/api/v1/employees/:id/payroll-schedule",
    wrap(async (req, res) => {
      const s = await context(req),
        id = uuid.parse(req.params.id);
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const employee = (
            await c.query(
              "SELECT id,branch_id,base_salary_minor,payroll_frequency,payroll_start_on::text,payroll_enabled FROM employees WHERE tenant_id=$1 AND id=$2",
              [s.tenant_id, id],
            )
          ).rows[0];
          if (!employee) throw new HttpError(404, "Employee not found");
          sameBranch(s, employee.branch_id);
          return employee;
        }),
      );
    }),
  );
  app.patch(
    "/api/v1/employees/:id/payroll-schedule",
    wrap(async (req, res) => {
      const s = await context(req, true),
        id = uuid.parse(req.params.id),
        d = z
          .object({
            payroll_frequency: frequency,
            payroll_start_on: z.string().date(),
            payroll_enabled: z.boolean(),
          })
          .strict()
          .parse(req.body);
      const earliest = new Date();
      earliest.setUTCFullYear(earliest.getUTCFullYear() - 10);
      if (d.payroll_start_on < earliest.toISOString().slice(0, 10))
        throw new HttpError(422, "Choose a start within the last ten years.");
      await scoped(s.tenant_id, async (c) => {
        const e = (
          await c.query(
            "SELECT branch_id FROM employees WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
            [s.tenant_id, id],
          )
        ).rows[0];
        if (!e) throw new HttpError(404, "Employee not found");
        sameBranch(s, e.branch_id);
        await c.query(
          "UPDATE employees SET payroll_frequency=$3,payroll_start_on=$4,payroll_enabled=$5 WHERE tenant_id=$1 AND id=$2",
          [
            s.tenant_id,
            id,
            d.payroll_frequency,
            d.payroll_start_on,
            d.payroll_enabled,
          ],
        );
        await audit(
          c,
          s.user_id,
          s.tenant_id,
          "employee.payroll_schedule.updated",
          id,
        );
      });
      await generatePayroll(s.tenant_id, s.branch_id);
      ok(res, { saved: true });
    }),
  );
  app.get(
    "/api/v1/payroll",
    wrap(async (req, res) => {
      const s = await context(req);
      await generatePayroll(s.tenant_id, s.branch_id);
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const records = (
            await c.query(
              "SELECT p.*,p.period_start::text,p.period_end::text,e.name employee_name,e.image_version,e.branch_id FROM payroll_records p JOIN employees e ON e.id=p.employee_id AND e.tenant_id=p.tenant_id WHERE p.tenant_id=$1 AND ($2::uuid IS NULL OR e.branch_id=$2) ORDER BY p.period_start DESC,p.created_at DESC LIMIT 200",
              [s.tenant_id, s.branch_id],
            )
          ).rows;
          for (const record of records) {
            const e = (
              await c.query(
                "SELECT * FROM employees WHERE tenant_id=$1 AND id=$2",
                [s.tenant_id, record.employee_id],
              )
            ).rows[0];
            Object.assign(
              record,
              await refreshPayroll(c, s.tenant_id, record, e),
            );
          }
          return records;
        }),
      );
    }),
  );
  app.post(
    "/api/v1/payroll",
    wrap(async (req, res) => {
      const s = await context(req, true),
        d = z
          .object({
            employee_id: uuid,
            period_start: z.string().date(),
            period_end: z.string().date(),
          })
          .strict()
          .parse(req.body);
      if (
        d.period_end < d.period_start ||
        Date.parse(d.period_end) - Date.parse(d.period_start) > 366 * 86400000
      )
        throw new HttpError(422, "Choose a period of at most one year.");
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const e = (
            await c.query(
              "SELECT * FROM employees WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
              [s.tenant_id, d.employee_id],
            )
          ).rows[0];
          if (!e) throw new HttpError(404, "Employee not found");
          sameBranch(s, e.branch_id);
          if (
            (
              await c.query(
                "SELECT 1 FROM payroll_records WHERE tenant_id=$1 AND employee_id=$2 AND period_start<=$4::date AND period_end>=$3::date",
                [s.tenant_id, e.id, d.period_start, d.period_end],
              )
            ).rowCount
          )
            throw new HttpError(
              409,
              "A payroll already covers some or all of these dates. Open that draft instead.",
            );
          const calc = await calculatePayroll(
            c,
            s.tenant_id,
            e,
            d.period_start,
            d.period_end,
          );
          const record = (
            await c.query(
              "INSERT INTO payroll_records(tenant_id,employee_id,period_start,period_end,base_minor,commission_minor,unpaid_leave_minor,automatic,calculation,calculated_at) VALUES($1,$2,$3,$4,$5,$6,$7,true,$8::jsonb,now()) RETURNING *",
              [
                s.tenant_id,
                e.id,
                d.period_start,
                d.period_end,
                calc.base_minor,
                calc.commission_minor,
                calc.unpaid_leave_minor,
                JSON.stringify(calc.calculation),
              ],
            )
          ).rows[0];
          await audit(c, s.user_id, s.tenant_id, "payroll.created", record.id);
          return record;
        }),
        201,
      );
    }),
  );
  app.get(
    "/api/v1/payroll/:id",
    wrap(async (req, res) => {
      const s = await context(req),
        id = uuid.parse(req.params.id);
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const record = (
            await c.query(
              "SELECT p.*,p.period_start::text,p.period_end::text FROM payroll_records p WHERE p.tenant_id=$1 AND p.id=$2 FOR UPDATE",
              [s.tenant_id, id],
            )
          ).rows[0];
          if (!record) throw new HttpError(404, "Payroll not found");
          const employee = (
            await c.query(
              "SELECT e.*,b.name branch_name FROM employees e JOIN branches b ON b.tenant_id=e.tenant_id AND b.id=e.branch_id WHERE e.tenant_id=$1 AND e.id=$2",
              [s.tenant_id, record.employee_id],
            )
          ).rows[0];
          sameBranch(s, employee.branch_id);
          const refreshed = await refreshPayroll(
            c,
            s.tenant_id,
            record,
            employee,
          );
          delete employee.base_salary_minor;
          return {
            record: refreshed,
            employee,
            total_minor: Math.max(
              0,
              Number(refreshed.base_minor) +
                Number(refreshed.commission_minor) +
                Number(refreshed.bonus_minor) -
                Number(refreshed.deduction_minor) -
                Number(refreshed.unpaid_leave_minor),
            ),
          };
        }),
      );
    }),
  );
  app.patch(
    "/api/v1/payroll/:id",
    wrap(async (req, res) => {
      const s = await context(req, true),
        id = uuid.parse(req.params.id),
        d = z
          .object({
            bonus_minor: z.number().int().min(0).max(1000000000).optional(),
            deduction_minor: z.number().int().min(0).max(1000000000).optional(),
            deduction_reason: z
              .string()
              .max(1000)
              .transform((v) => plainText(v))
              .optional(),
            bonus_reason: z
              .string()
              .max(1000)
              .transform((v) => plainText(v))
              .optional(),
            status: z.literal("paid").optional(),
            expected_total_minor: z.number().int().min(0).optional(),
          })
          .strict()
          .parse(req.body);
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          let p = (
            await c.query(
              "SELECT *,period_start::text,period_end::text FROM payroll_records WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
              [s.tenant_id, id],
            )
          ).rows[0];
          if (!p) throw new HttpError(404, "Payroll not found");
          const e = (
            await c.query(
              "SELECT * FROM employees WHERE tenant_id=$1 AND id=$2",
              [s.tenant_id, p.employee_id],
            )
          ).rows[0];
          sameBranch(s, e.branch_id);
          if (p.status !== "draft")
            throw new HttpError(409, "Paid payroll cannot be changed.");
          p = await refreshPayroll(c, s.tenant_id, p, e);
          const next = { ...p, ...d };
          if (
            Number(next.deduction_minor) > 0 &&
            !next.deduction_reason?.trim()
          )
            throw new HttpError(422, "Add a reason for the deduction.");
          if (
            Number(next.deduction_minor) + Number(next.unpaid_leave_minor) >
            Number(next.base_minor) +
              Number(next.commission_minor) +
              Number(next.bonus_minor)
          )
            throw new HttpError(422, "Deductions cannot exceed earnings.");
          const paid = d.status === "paid" || Object.keys(d).length === 0;
          if (
            paid &&
            d.expected_total_minor !== undefined &&
            d.expected_total_minor !==
              Math.max(
                0,
                Number(next.base_minor) +
                  Number(next.commission_minor) +
                  Number(next.bonus_minor) -
                  Number(next.deduction_minor) -
                  Number(next.unpaid_leave_minor),
              )
          )
            throw new HttpError(
              409,
              "Payroll changed since you opened it. Refresh and review the new total before recording payment.",
            );
          if (paid && p.calculation?.warnings?.length)
            throw new HttpError(422, p.calculation.warnings[0]);
          const record = (
            await c.query(
              "UPDATE payroll_records SET bonus_minor=$3,deduction_minor=$4,deduction_reason=$5,bonus_reason=$6,status=$7,paid_at=CASE WHEN $7='paid' THEN now() ELSE NULL END WHERE tenant_id=$1 AND id=$2 RETURNING *",
              [
                s.tenant_id,
                id,
                next.bonus_minor,
                next.deduction_minor,
                next.deduction_reason,
                next.bonus_reason,
                paid ? "paid" : "draft",
              ],
            )
          ).rows[0];
          await audit(
            c,
            s.user_id,
            s.tenant_id,
            paid ? "payroll.recorded_paid" : "payroll.adjusted",
            id,
          );
          return record;
        }),
      );
    }),
  );
}
