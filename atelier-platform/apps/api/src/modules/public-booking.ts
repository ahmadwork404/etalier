import type express from "express";
import { z } from "zod";
import { pool, scoped } from "../db.js";
import { wrap, ok, feature, authLimit } from "../runtime.js";
import { HttpError } from "../security.js";
import { createAppointment } from "../services/create-appointment.js";
async function salon(slug: string) {
  const t = (
    await pool.query(
      "SELECT * FROM tenants WHERE slug=$1 AND status='active'",
      [slug],
    )
  ).rows[0];
  if (!t) throw new HttpError(404, "Salon not found");
  await feature(t.id, "public_booking", t.plan);
  return t;
}
export function register(app: express.Express) {
  app.get(
    "/api/v1/booking/:slug",
    authLimit,
    wrap(async (req, res) => {
      const t = await salon(z.string().max(63).parse(req.params.slug));
      ok(
        res,
        await scoped(t.id, async (c) => ({
          salon: {
            name: t.name,
            currency: t.currency,
            timezone: t.timezone,
            brand_color: t.brand_color,
            address: t.address,
            cancel_hours: t.cancel_hours,
          },
          branches: (
            await c.query(
              "SELECT id,name FROM branches WHERE tenant_id=$1 AND active",
              [t.id],
            )
          ).rows,
          services: (
            await c.query(
              "SELECT id,name,duration_minutes,price_minor FROM services WHERE tenant_id=$1 AND active",
              [t.id],
            )
          ).rows,
          employees: (
            await c.query(
              "SELECT id,name,title,branch_id FROM employees WHERE tenant_id=$1 AND active",
              [t.id],
            )
          ).rows,
        })),
      );
    }),
  );
  app.get(
    "/api/v1/booking/:slug/availability",
    authLimit,
    wrap(async (req, res) => {
      const t = await salon(z.string().max(63).parse(req.params.slug));
      const d = z
        .object({ employee_id: z.string().uuid(), date: z.string().date() })
        .parse(req.query);
      ok(
        res,
        await scoped(t.id, async (c) => {
          const local = (
            await c.query(
              "SELECT extract(dow FROM $1::date)::integer weekday",
              [d.date],
            )
          ).rows[0];
          const hours = (
            await c.query(
              "SELECT opens_at,closes_at FROM employee_schedules WHERE tenant_id=$1 AND employee_id=$2 AND weekday=$3",
              [t.id, d.employee_id, local.weekday],
            )
          ).rows;
          const appointments = (
            await c.query(
              "SELECT starts_at,ends_at FROM appointments WHERE tenant_id=$1 AND employee_id=$2 AND (starts_at AT TIME ZONE $4)::date=$3::date AND status NOT IN ('cancelled','no_show','rescheduled')",
              [t.id, d.employee_id, d.date, t.timezone],
            )
          ).rows;
          return { timezone: t.timezone, hours, busy: appointments };
        }),
      );
    }),
  );
  app.post(
    "/api/v1/booking/:slug",
    authLimit,
    wrap(async (req, res) => {
      const t = await salon(z.string().max(63).parse(req.params.slug));
      const d = z
        .object({
          name: z.string().min(2).max(120),
          email: z.string().email(),
          phone: z.string().min(6).max(40),
          branch_id: z.string().uuid(),
          employee_id: z.string().uuid(),
          service_ids: z.array(z.string().uuid()).min(1).max(10),
          starts_at: z.string().datetime({ offset: true }),
          notes: z.string().max(2000).default(""),
          marketing_consent: z.boolean().default(false),
        })
        .parse(req.body);
      const a = await scoped(t.id, async (c) => {
        const customer = (
          await c.query(
            "INSERT INTO customers(tenant_id,name,email,phone,marketing_consent) VALUES($1,$2,$3,$4,$5) RETURNING id",
            [t.id, d.name, d.email, d.phone, d.marketing_consent],
          )
        ).rows[0];
        return createAppointment(
          { tenant_id: t.id, user_id: null, plan: t.plan },
          { ...d, customer_id: customer.id },
          c,
        );
      });
      ok(
        res,
        { reference: a.id, starts_at: a.starts_at, status: a.status },
        201,
      );
    }),
  );
}
