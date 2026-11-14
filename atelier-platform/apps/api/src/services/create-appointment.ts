import type { PoolClient } from "pg";
import { scoped, audit } from "../db.js";
import { HttpError, digest } from "../security.js";
import { validateSlot } from "./booking.js";
import { enqueueEvent } from "./events.js";
export async function createAppointment(s: any, d: any, client?: PoolClient) {
  const perform = async (c: PoolClient) => {
    const requestHash = d.request_key
      ? digest(
          JSON.stringify({
            customer_id: d.customer_id,
            employee_id: d.employee_id,
            branch_id: d.branch_id,
            service_ids: [...d.service_ids].sort(),
            starts_at: d.starts_at,
            notes: d.notes,
            paid_in_advance: !!d.paid_in_advance,
            payment_method: d.paid_in_advance
              ? d.payment_method || "cash"
              : null,
          }),
        )
      : null;
    if (d.request_key) {
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        s.tenant_id + ":booking:" + d.request_key,
      ]);
      const prior = (
        await c.query(
          "SELECT * FROM appointments WHERE tenant_id=$1 AND booking_request_key=$2",
          [s.tenant_id, d.request_key],
        )
      ).rows[0];
      if (prior) {
        if (prior.booking_request_hash !== requestHash)
          throw new HttpError(
            409,
            "This booking request was already used with different details.",
          );
        return prior;
      }
    }
    const settings = (
      await c.query("SELECT * FROM tenants WHERE id=$1", [s.tenant_id])
    ).rows[0];
    const start = new Date(d.starts_at);
    const advance = start.getTime() - Date.now();
    if (
      advance < settings.booking_min_hours * 3600000 ||
      advance > settings.booking_max_days * 86400000
    )
      throw new HttpError(
        422,
        "Appointment falls outside the advance booking window",
      );
    if (
      !(
        await c.query(
          "SELECT 1 FROM customers WHERE tenant_id=$1 AND id=$2 AND deleted_at IS NULL",
          [s.tenant_id, d.customer_id],
        )
      ).rowCount
    )
      throw new HttpError(422, "Customer unavailable");
    const services = (
      await c.query(
        "SELECT * FROM services WHERE tenant_id=$1 AND id=ANY($2::uuid[]) AND active",
        [s.tenant_id, d.service_ids],
      )
    ).rows;
    if (
      services.length !== new Set(d.service_ids).size ||
      new Set(d.service_ids).size !== d.service_ids.length
    )
      throw new HttpError(422, "Choose distinct active services");
    const minutes = services.reduce(
      (a, r) => a + r.duration_minutes + r.buffer_minutes,
      0,
    );
    const end = new Date(start.getTime() + minutes * 60000);
    await validateSlot(c, s.tenant_id, d.employee_id, d.branch_id, start, end);
    const row = (
      await c.query(
        "INSERT INTO appointments(tenant_id,branch_id,customer_id,employee_id,starts_at,ends_at,notes,paid_in_advance,booking_request_key,booking_request_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
        [
          s.tenant_id,
          d.branch_id,
          d.customer_id,
          d.employee_id,
          start,
          end,
          d.notes,
          !!d.paid_in_advance,
          d.request_key || null,
          requestHash,
        ],
      )
    ).rows[0];
    for (const sv of services)
      await c.query(
        "INSERT INTO appointment_services(tenant_id,appointment_id,service_id,price_minor,duration_minutes) VALUES($1,$2,$3,$4,$5)",
        [s.tenant_id, row.id, sv.id, sv.price_minor, sv.duration_minutes],
      );
    if (d.paid_in_advance) {
      const method = d.payment_method || "cash";
      if (!settings.payment_methods.includes(method) || method === "stripe")
        throw new HttpError(422, "Choose an enabled manual payment method.");
      const subtotal = services.reduce(
          (sum, sv) => sum + Number(sv.price_minor),
          0,
        ),
        tax = Math.round(
          (subtotal * Number(settings.tax_basis_points)) / 10000,
        ),
        total = subtotal + tax;
      const order = (
        await c.query(
          "INSERT INTO orders(tenant_id,branch_id,customer_id,appointment_id,employee_id,subtotal_minor,tax_minor,total_minor,status,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'paid',$9) RETURNING id",
          [
            s.tenant_id,
            d.branch_id,
            d.customer_id,
            row.id,
            d.employee_id,
            subtotal,
            tax,
            total,
            "booking:" + row.id + ":advance",
          ],
        )
      ).rows[0];
      for (const sv of services)
        await c.query(
          "INSERT INTO order_items(tenant_id,order_id,service_id,name,quantity,price_minor) VALUES($1,$2,$3,$4,1,$5)",
          [s.tenant_id, order.id, sv.id, sv.name, sv.price_minor],
        );
      if (total > 0)
        await c.query(
          "INSERT INTO payments(tenant_id,order_id,amount_minor,method,idempotency_key) VALUES($1,$2,$3,$4,$5)",
          [
            s.tenant_id,
            order.id,
            total,
            method,
            "booking:" + row.id + ":advance",
          ],
        );
      await audit(
        c,
        s.user_id,
        s.tenant_id,
        "booking.advance_payment.recorded",
        order.id,
      );
      row.order_id = order.id;
    }
    await enqueueEvent(c, s, "appointment.created", row);
    await audit(c, s.user_id, s.tenant_id, "appointment.created", row.id);
    return row;
  };
  return client ? perform(client) : scoped(s.tenant_id, perform);
}
