import type { PoolClient } from "pg";
import { pool, scoped } from "../db.js";
import { feature } from "../runtime.js";
import { logger } from "../logger.js";
import { HttpError } from "../security.js";
const dayMs = 86400000;
export function payrollPeriods(
  start: string,
  today: string,
  frequency: string,
) {
  const result: { start: string; end: string }[] = [];
  let date = new Date(start + "T00:00:00Z");
  while (date.toISOString().slice(0, 10) <= today) {
    const end = new Date(date);
    if (frequency === "monthly") end.setUTCMonth(end.getUTCMonth() + 1, 0);
    else
      end.setUTCDate(
        end.getUTCDate() +
          ({ daily: 1, weekly: 7, biweekly: 15 }[frequency] || 1) -
          1,
      );
    result.push({
      start: date.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    });
    date = new Date(end.getTime() + dayMs);
    if (result.length > 3700)
      throw new HttpError(
        422,
        "Choose a payroll start within the last ten years.",
      );
  }
  return result;
}
export function proratedBase(monthly: number, start: string, end: string) {
  let sum = 0;
  for (
    let day = new Date(start + "T00:00:00Z");
    day.toISOString().slice(0, 10) <= end;
    day = new Date(day.getTime() + dayMs)
  )
    sum +=
      monthly /
      new Date(
        Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0),
      ).getUTCDate();
  return Math.round(sum);
}
export async function calculatePayroll(
  c: PoolClient,
  tenant: string,
  employee: any,
  start: string,
  end: string,
) {
  const base = proratedBase(Number(employee.base_salary_minor), start, end);
  const commissions = (
    await c.query(
      "SELECT id,amount_minor,created_at,appointment_id,quick_visit_id FROM commissions WHERE tenant_id=$1 AND employee_id=$2 AND created_at >= $3::date AND created_at < $4::date+interval '1 day' ORDER BY created_at",
      [tenant, employee.id, start, end],
    )
  ).rows;
  const leaves = (
    await c.query(
      "SELECT id,reason,paid,to_char(starts_at,'YYYY-MM-DD HH24:MI') starts_local,to_char(ends_at,'YYYY-MM-DD HH24:MI') ends_local FROM employee_leaves WHERE tenant_id=$1 AND employee_id=$2 AND starts_at < $4::date+interval '1 day' AND ends_at > $3::date ORDER BY starts_at",
      [tenant, employee.id, start, end],
    )
  ).rows;
  const unpaid = (
    await c.query(
      `WITH days AS (SELECT d::date day_date FROM generate_series($3::date::timestamp,$4::date::timestamp,interval '1 day') d), shifts AS (SELECT day_date,(day_date+es.opens_at) AT TIME ZONE current_setting('TimeZone') shift_start,(day_date+es.closes_at) AT TIME ZONE current_setting('TimeZone') shift_end FROM days JOIN employee_schedules es ON es.tenant_id=$1 AND es.employee_id=$2 AND es.weekday=extract(dow FROM day_date)), missed AS (SELECT sh.day_date,sum(extract(epoch FROM LEAST(l.ends_at,sh.shift_end)-GREATEST(l.starts_at,sh.shift_start))) seconds,extract(epoch FROM sh.shift_end-sh.shift_start) shift_seconds FROM shifts sh JOIN employee_leaves l ON l.tenant_id=$1 AND l.employee_id=$2 AND NOT l.paid AND l.starts_at<sh.shift_end AND l.ends_at>sh.shift_start GROUP BY sh.day_date,sh.shift_start,sh.shift_end) SELECT day_date::text date,LEAST(1,seconds/NULLIF(shift_seconds,0)) fraction,seconds/3600 hours,extract(day FROM date_trunc('month',day_date)+interval '1 month'-interval '1 day') days_in_month FROM missed ORDER BY day_date`,
      [tenant, employee.id, start, end],
    )
  ).rows;
  const unpaidDays = unpaid.map((day) => ({
    ...day,
    amount_minor: Math.round(
      (Number(employee.base_salary_minor) / Number(day.days_in_month)) *
        Number(day.fraction),
    ),
  }));
  const deduction = Math.min(
    base,
    unpaidDays.reduce((sum, day) => sum + day.amount_minor, 0),
  );
  const hoursCount = Number(
    (
      await c.query(
        "SELECT count(*) FROM employee_schedules WHERE tenant_id=$1 AND employee_id=$2",
        [tenant, employee.id],
      )
    ).rows[0].count,
  );
  const warnings =
    leaves.some((l) => !l.paid) && !hoursCount
      ? [
          "Configure working hours to calculate unpaid leave before marking this payroll paid.",
        ]
      : [];
  const commission = commissions.reduce(
    (sum, row) => sum + Number(row.amount_minor),
    0,
  );
  const timezone = (
    await c.query("SELECT current_setting('TimeZone') timezone")
  ).rows[0].timezone;
  return {
    base_minor: base,
    commission_minor: commission,
    unpaid_leave_minor: deduction,
    calculation: {
      monthly_base_minor: Number(employee.base_salary_minor),
      frequency: employee.payroll_frequency,
      period_start: start,
      period_end: end,
      timezone,
      formula:
        "Monthly base / calendar days in each month × covered days. Unpaid leave is the missed fraction of scheduled working hours, using the same daily rate. Commission is accrued within the period.",
      commissions,
      leaves,
      unpaid_days: unpaidDays,
      warnings,
    },
  };
}
export async function refreshPayroll(
  c: PoolClient,
  tenant: string,
  record: any,
  employee: any,
) {
  if (record.status !== "draft" || !record.automatic) return record;
  const result = await calculatePayroll(
    c,
    tenant,
    employee,
    String(record.period_start).slice(0, 10),
    String(record.period_end).slice(0, 10),
  );
  return (
    await c.query(
      "UPDATE payroll_records SET base_minor=$3,commission_minor=$4,unpaid_leave_minor=$5,calculation=$6::jsonb,calculated_at=now() WHERE tenant_id=$1 AND id=$2 RETURNING *,period_start::text,period_end::text",
      [
        tenant,
        record.id,
        result.base_minor,
        result.commission_minor,
        result.unpaid_leave_minor,
        JSON.stringify(result.calculation),
      ],
    )
  ).rows[0];
}
export async function generatePayroll(
  tenant: string,
  branch: string | null = null,
) {
  return scoped(tenant, async (c) => {
    const today = (await c.query("SELECT to_char(now(),'YYYY-MM-DD') today"))
      .rows[0].today;
    const employees = (
      await c.query(
        "SELECT *,payroll_start_on::text FROM employees WHERE tenant_id=$1 AND active AND payroll_enabled AND ($2::uuid IS NULL OR branch_id=$2) ORDER BY id FOR UPDATE",
        [tenant, branch],
      )
    ).rows;
    for (const employee of employees) {
      for (const period of payrollPeriods(
        employee.payroll_start_on,
        today,
        employee.payroll_frequency,
      )) {
        const overlap = (
          await c.query(
            "SELECT id,period_start::text,period_end::text,status FROM payroll_records WHERE tenant_id=$1 AND employee_id=$2 AND period_start<=$4::date AND period_end>=$3::date",
            [tenant, employee.id, period.start, period.end],
          )
        ).rows;
        if (overlap.length) continue;
        const calc = await calculatePayroll(
          c,
          tenant,
          employee,
          period.start,
          period.end,
        );
        const row = (
          await c.query(
            "INSERT INTO payroll_records(tenant_id,employee_id,period_start,period_end,base_minor,commission_minor,unpaid_leave_minor,automatic,calculation,calculated_at) VALUES($1,$2,$3,$4,$5,$6,$7,true,$8::jsonb,now()) ON CONFLICT DO NOTHING RETURNING id",
            [
              tenant,
              employee.id,
              period.start,
              period.end,
              calc.base_minor,
              calc.commission_minor,
              calc.unpaid_leave_minor,
              JSON.stringify(calc.calculation),
            ],
          )
        ).rows[0];
        if (row)
          await c.query(
            "INSERT INTO audit_logs(tenant_id,action,target_id) VALUES($1,'payroll.draft.generated',$2)",
            [tenant, row.id],
          );
      }
    }
  });
}
export function startPayrollScheduler() {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      for (const tenant of (
        await pool.query("SELECT id,plan FROM tenants WHERE status='active'")
      ).rows) {
        try {
          await feature(tenant.id, "employees", tenant.plan);
          await generatePayroll(tenant.id);
        } catch (error) {
          if (!(error instanceof HttpError && error.status === 403))
            logger.error(
              { tenant_id: tenant.id, code: (error as any)?.code },
              "payroll_generation_failed",
            );
        }
      }
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(() => {
    tick().catch(() => console.error("Payroll generation failed"));
  }, 60000);
  timer.unref();
}
