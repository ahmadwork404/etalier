import type { PoolClient } from "pg";
import { HttpError } from "../security.js";
export async function validateSlot(
  c: PoolClient,
  tenant: string,
  employee: string,
  branch: string,
  start: Date,
  end: Date,
) {
  const e = (
    await c.query(
      "SELECT * FROM employees WHERE tenant_id=$1 AND id=$2 AND branch_id=$3 AND active FOR UPDATE",
      [tenant, employee, branch],
    )
  ).rows[0];
  if (!e) throw new HttpError(422, "Select an active employee in this branch");
  const timezone = (
    await c.query("SELECT timezone FROM tenants WHERE id=$1", [tenant])
  ).rows[0].timezone;
  const local = (
    await c.query(
      "SELECT extract(dow FROM $1::timestamptz AT TIME ZONE $3)::integer weekday,($1::timestamptz AT TIME ZONE $3)::time starts,($2::timestamptz AT TIME ZONE $3)::time ends,($1::timestamptz AT TIME ZONE $3)::date first_date,($2::timestamptz AT TIME ZONE $3)::date last_date",
      [start, end, timezone],
    )
  ).rows[0];
  if (String(local.first_date) !== String(local.last_date))
    throw new HttpError(422, "Appointments must end on the same local day");
  const schedules = (
    await c.query(
      "SELECT * FROM employee_schedules WHERE tenant_id=$1 AND employee_id=$2",
      [tenant, employee],
    )
  ).rows;
  if (!schedules.length)
    throw new HttpError(
      422,
      "Set working hours for this employee before booking",
    );
  if (
    !schedules.some(
      (s) =>
        s.weekday === local.weekday &&
        s.opens_at <= local.starts &&
        s.closes_at >= local.ends,
    )
  )
    throw new HttpError(
      409,
      "This appointment is outside employee working hours",
    );
  if (
    (
      await c.query(
        "SELECT 1 FROM employee_leaves WHERE tenant_id=$1 AND employee_id=$2 AND starts_at<$4 AND ends_at>$3",
        [tenant, employee, start, end],
      )
    ).rowCount
  )
    throw new HttpError(409, "Employee is on leave at this time");
  return e;
}
