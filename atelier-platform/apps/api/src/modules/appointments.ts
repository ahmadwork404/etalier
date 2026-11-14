import { createAppointment } from "../services/create-appointment.js";
import { enqueueEvent } from "../services/events.js";
import type express from "express";
import { z } from "zod";
import { scoped, audit } from "../db.js";
import { wrap, ok, tenantContext, feature } from "../runtime.js";
import { HttpError } from "../security.js";
import { validateSlot } from "../services/booking.js";
import { sameBranch, moveStock } from "../services/inventory.js";
const uuid = z.string().uuid();
const appointment = z.object({
  branch_id: uuid,
  customer_id: uuid,
  employee_id: uuid,
  service_ids: z.array(uuid).min(1).max(10),
  starts_at: z.string().datetime({ offset: true }),
  notes: z.string().max(5000).default(""),
  paid_in_advance: z.boolean().default(false),
  payment_method: z
    .enum([
      "cash",
      "card",
      "zelle",
      "venmo",
      "cash_app",
      "other",
      "bank_transfer",
    ])
    .optional(),
  request_key: z.string().uuid().optional(),
});
export function register(app: express.Express) {
  app.get(
    "/api/v1/appointments",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "appointments.read");
      await feature(s.tenant_id, "appointments", s.plan);
      const q = z
        .object({
          from: z.string().datetime({ offset: true }),
          to: z.string().datetime({ offset: true }),
          employee_id: uuid.optional(),
          branch_id: uuid.optional(),
          include_walkins: z.enum(["true", "false"]).default("false"),
        })
        .parse(req.query);
      if (new Date(q.to).getTime() - new Date(q.from).getTime() > 93 * 86400000)
        throw new HttpError(422, "Select a range of at most 93 days");
      if (q.branch_id) sameBranch(s, q.branch_id);
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const args = [
            s.tenant_id,
            q.from,
            q.to,
            q.employee_id || null,
            s.branch_id || q.branch_id || null,
          ];
          const items = (
            await c.query(
              `SELECT a.*,'booking' kind,cu.name customer_name,e.name employee_name,b.name branch_name,o.id order_id,COALESCE((SELECT json_agg(json_build_object('id',ss.service_id,'name',sv.name,'price_minor',ss.price_minor,'duration_minutes',ss.duration_minutes)) FROM appointment_services ss JOIN services sv ON sv.id=ss.service_id AND sv.tenant_id=ss.tenant_id WHERE ss.tenant_id=a.tenant_id AND ss.appointment_id=a.id),'[]') services FROM appointments a JOIN customers cu ON cu.id=a.customer_id AND cu.tenant_id=a.tenant_id JOIN employees e ON e.id=a.employee_id AND e.tenant_id=a.tenant_id JOIN branches b ON b.id=a.branch_id AND b.tenant_id=a.tenant_id LEFT JOIN orders o ON o.tenant_id=a.tenant_id AND o.appointment_id=a.id WHERE a.tenant_id=$1 AND a.starts_at>=$2 AND a.starts_at<$3 AND ($4::uuid IS NULL OR a.employee_id=$4) AND ($5::uuid IS NULL OR a.branch_id=$5) ORDER BY a.starts_at LIMIT 1000`,
              args,
            )
          ).rows;
          if (q.include_walkins === "true")
            items.push(
              ...(
                await c.query(
                  `SELECT v.id,v.created_at starts_at,v.created_at ends_at,'completed' status,'walkin' kind,v.branch_id,v.employee_id,v.customer_id,v.order_id,cu.name customer_name,e.name employee_name,b.name branch_name,false paid_in_advance,COALESCE((SELECT json_agg(json_build_object('id',qs.service_id,'name',qs.name,'price_minor',qs.price_minor)) FROM quick_work_services qs WHERE qs.tenant_id=v.tenant_id AND qs.visit_id=v.id),'[]') services FROM quick_work_visits v JOIN customers cu ON cu.tenant_id=v.tenant_id AND cu.id=v.customer_id JOIN employees e ON e.tenant_id=v.tenant_id AND e.id=v.employee_id JOIN branches b ON b.tenant_id=v.tenant_id AND b.id=v.branch_id WHERE v.tenant_id=$1 AND v.created_at >=$2 AND v.created_at<$3 AND ($4::uuid IS NULL OR v.employee_id=$4) AND ($5::uuid IS NULL OR v.branch_id=$5) ORDER BY v.created_at LIMIT 1000`,
                  args,
                )
              ).rows,
            );
          return items.sort(
            (a, b) =>
              new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
          );
        }),
      );
    }),
  );
  app.post(
    "/api/v1/appointments",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "appointments.write");
      await feature(s.tenant_id, "appointments", s.plan);
      const d = appointment.parse(req.body);
      sameBranch(s, d.branch_id);
      if (d.paid_in_advance) {
        await tenantContext(req, "finance.write");
        await feature(s.tenant_id, "pos", s.plan);
      }
      const result = await createAppointment(s, d);
      ok(res, result, 201);
    }),
  );
  app.patch(
    "/api/v1/appointments/:id",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "appointments.write");
      await feature(s.tenant_id, "appointments", s.plan);
      const id = uuid.parse(req.params.id);
      const d = z
        .object({
          status: z
            .enum([
              "confirmed",
              "checked_in",
              "in_progress",
              "completed",
              "cancelled",
              "no_show",
            ])
            .optional(),
          starts_at: z.string().datetime({ offset: true }).optional(),
        })
        .refine((d) => d.status || d.starts_at)
        .parse(req.body);
      let inventoryAllowed = true;
      if (d.status === "completed")
        try {
          await feature(s.tenant_id, "inventory", s.plan);
        } catch (error) {
          if (error instanceof HttpError && error.status === 403)
            inventoryAllowed = false;
          else throw error;
        }
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const a = (
            await c.query(
              "SELECT * FROM appointments WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
              [s.tenant_id, id],
            )
          ).rows[0];
          if (!a) throw new HttpError(404, "Appointment not found");
          sameBranch(s, a.branch_id);
          if (["completed", "cancelled", "no_show"].includes(a.status))
            throw new HttpError(409, "This appointment is closed");
          if (d.starts_at) {
            const start = new Date(d.starts_at),
              end = new Date(
                start.getTime() +
                  new Date(a.ends_at).getTime() -
                  new Date(a.starts_at).getTime(),
              );
            if (start.getTime() <= Date.now())
              throw new HttpError(422, "Choose a future time");
            await validateSlot(
              c,
              s.tenant_id,
              a.employee_id,
              a.branch_id,
              start,
              end,
            );
            await c.query(
              "UPDATE appointments SET starts_at=$3,ends_at=$4 WHERE tenant_id=$1 AND id=$2",
              [s.tenant_id, id, start, end],
            );
          }
          if (d.status === "completed") {
            const consumables = (
              await c.query(
                "SELECT sc.product_id,sum(sc.quantity) quantity FROM appointment_services aps JOIN service_consumables sc ON sc.tenant_id=aps.tenant_id AND sc.service_id=aps.service_id WHERE aps.tenant_id=$1 AND aps.appointment_id=$2 GROUP BY sc.product_id ORDER BY sc.product_id",
                [s.tenant_id, id],
              )
            ).rows;
            for (const p of inventoryAllowed ? consumables : [])
              await moveStock(
                c,
                s.tenant_id,
                a.branch_id,
                p.product_id,
                -Number(p.quantity),
                "service_consumption",
                s.user_id,
                id,
              );
            const commission = (
              await c.query(
                "SELECT e.commission_basis_points,sum(s.price_minor) total FROM employees e JOIN appointment_services s ON s.tenant_id=e.tenant_id WHERE e.tenant_id=$1 AND e.id=$2 AND s.appointment_id=$3 GROUP BY e.commission_basis_points",
                [s.tenant_id, a.employee_id, id],
              )
            ).rows[0];
            await c.query(
              "INSERT INTO commissions(tenant_id,employee_id,appointment_id,amount_minor) VALUES($1,$2,$3,$4)",
              [
                s.tenant_id,
                a.employee_id,
                id,
                Math.round(
                  (Number(commission?.total || 0) *
                    Number(commission?.commission_basis_points || 0)) /
                    10000,
                ),
              ],
            );
          }
          if (d.status === "completed")
            await enqueueEvent(c, s, "appointment.completed", a);
          if (d.status)
            await c.query(
              "UPDATE appointments SET status=$3 WHERE tenant_id=$1 AND id=$2",
              [s.tenant_id, id, d.status],
            );
          await audit(
            c,
            s.user_id,
            s.tenant_id,
            "appointment." + (d.status || "rescheduled"),
            id,
          );
          return (
            await c.query(
              "SELECT * FROM appointments WHERE tenant_id=$1 AND id=$2",
              [s.tenant_id, id],
            )
          ).rows[0];
        }),
      );
    }),
  );
  app.get(
    "/api/v1/employee-schedules",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "employees.read");
      await feature(s.tenant_id, "employees", s.plan);
      ok(
        res,
        await scoped(
          s.tenant_id,
          async (c) =>
            (
              await c.query(
                "SELECT es.*,e.name employee_name FROM employee_schedules es JOIN employees e ON e.id=es.employee_id AND e.tenant_id=es.tenant_id WHERE es.tenant_id=$1 AND ($2::uuid IS NULL OR e.branch_id=$2) ORDER BY e.name,weekday",
                [s.tenant_id, s.branch_id],
              )
            ).rows,
        ),
      );
    }),
  );
  app.post(
    "/api/v1/employee-schedules",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "employees.write");
      await feature(s.tenant_id, "employees", s.plan);
      const d = z
        .object({
          employee_id: uuid,
          weekday: z.number().int().min(0).max(6),
          opens_at: z.string().regex(/^\d{2}:\d{2}$/),
          closes_at: z.string().regex(/^\d{2}:\d{2}$/),
        })
        .refine((d) => d.closes_at > d.opens_at)
        .parse(req.body);
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const e = (
            await c.query(
              "SELECT branch_id FROM employees WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
              [s.tenant_id, d.employee_id],
            )
          ).rows[0];
          if (!e) throw new HttpError(404, "Employee not found");
          sameBranch(s, e.branch_id);
          const row = (
            await c.query(
              "INSERT INTO employee_schedules(tenant_id,employee_id,weekday,opens_at,closes_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(tenant_id,employee_id,weekday) DO UPDATE SET opens_at=$4,closes_at=$5 RETURNING *",
              [s.tenant_id, d.employee_id, d.weekday, d.opens_at, d.closes_at],
            )
          ).rows[0];
          await audit(c, s.user_id, s.tenant_id, "schedule.updated", row.id);
          return row;
        }),
        201,
      );
    }),
  );
  app.get(
    "/api/v1/employee-leaves",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "employees.read");
      await feature(s.tenant_id, "employees", s.plan);
      ok(
        res,
        await scoped(
          s.tenant_id,
          async (c) =>
            (
              await c.query(
                "SELECT l.*,e.name employee_name FROM employee_leaves l JOIN employees e ON e.id=l.employee_id AND e.tenant_id=l.tenant_id WHERE l.tenant_id=$1 AND ($2::uuid IS NULL OR e.branch_id=$2) ORDER BY starts_at DESC LIMIT 100",
                [s.tenant_id, s.branch_id],
              )
            ).rows,
        ),
      );
    }),
  );
  app.post(
    "/api/v1/employee-leaves",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "employees.write");
      await feature(s.tenant_id, "employees", s.plan);
      const d = z
        .object({
          employee_id: uuid,
          starts_at: z.string().datetime({ offset: true }),
          ends_at: z.string().datetime({ offset: true }),
          reason: z.string().max(500),
          paid: z.boolean().default(true),
        })
        .refine((d) => new Date(d.ends_at) > new Date(d.starts_at))
        .parse(req.body);
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const e = (
            await c.query(
              "SELECT branch_id FROM employees WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
              [s.tenant_id, d.employee_id],
            )
          ).rows[0];
          if (!e) throw new HttpError(404, "Employee not found");
          sameBranch(s, e.branch_id);
          if (
            (
              await c.query(
                "SELECT 1 FROM appointments WHERE tenant_id=$1 AND employee_id=$2 AND starts_at<$4 AND ends_at>$3 AND status NOT IN ('cancelled','no_show','rescheduled')",
                [s.tenant_id, d.employee_id, d.starts_at, d.ends_at],
              )
            ).rowCount
          )
            throw new HttpError(
              409,
              "Reschedule existing appointments before adding leave",
            );
          if (
            (
              await c.query(
                "SELECT 1 FROM employee_leaves WHERE tenant_id=$1 AND employee_id=$2 AND starts_at<$4 AND ends_at>$3",
                [s.tenant_id, d.employee_id, d.starts_at, d.ends_at],
              )
            ).rowCount
          )
            throw new HttpError(
              409,
              "Overlapping leave already exists for this employee",
            );
          const row = (
            await c.query(
              "INSERT INTO employee_leaves(tenant_id,employee_id,starts_at,ends_at,reason,paid) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
              [
                s.tenant_id,
                d.employee_id,
                d.starts_at,
                d.ends_at,
                d.reason,
                d.paid,
              ],
            )
          ).rows[0];
          await audit(c, s.user_id, s.tenant_id, "leave.created", row.id);
          return row;
        }),
        201,
      );
    }),
  );
}
