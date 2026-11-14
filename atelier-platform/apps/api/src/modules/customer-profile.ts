import type express from "express";
import { z } from "zod";
import { scoped, audit } from "../db.js";
import { wrap, ok, tenantContext, feature } from "../runtime.js";
import { HttpError } from "../security.js";
import { integrationStatus } from "../services/providers.js";
const uuid = z.string().uuid();
export function register(app: express.Express) {
  app.get(
    "/api/v1/customers/:id",
    wrap(async (req, res) => {
      const session = await tenantContext(req, "customers.read");
      await feature(session.tenant_id, "customers", session.plan);
      const id = uuid.parse(req.params.id);
      const customer = await scoped(
        session.tenant_id,
        async (c) =>
          (
            await c.query(
              "SELECT * FROM customers WHERE tenant_id=$1 AND id=$2 AND deleted_at IS NULL",
              [session.tenant_id, id],
            )
          ).rows[0],
      );
      if (!customer) throw new HttpError(404, "Customer not found");
      const providers = integrationStatus();
      ok(res, {
        customer,
        delivery: { email: providers.resend, sms: providers.twilio },
      });
    }),
  );
  app.get(
    "/api/v1/customers/:id/appointments",
    wrap(async (req, res) => {
      const session = await tenantContext(req, "customers.read");
      await feature(session.tenant_id, "customers", session.plan);
      const id = uuid.parse(req.params.id),
        filters = z
          .object({
            section: z.enum(["upcoming", "past"]).default("upcoming"),
            page: z.coerce.number().int().min(1).max(100000).default(1),
          })
          .parse(req.query);
      ok(
        res,
        await scoped(session.tenant_id, async (c) => {
          if (
            !(
              await c.query(
                "SELECT 1 FROM customers WHERE tenant_id=$1 AND id=$2 AND deleted_at IS NULL",
                [session.tenant_id, id],
              )
            ).rowCount
          )
            throw new HttpError(404, "Customer not found");
          const upcoming =
            "a.starts_at >= now() AND a.status NOT IN ('completed','cancelled','no_show','rescheduled')";
          const where = `a.tenant_id=$1 AND a.customer_id=$2 AND ($3::uuid IS NULL OR a.branch_id=$3) AND ${filters.section === "upcoming" ? "(" + upcoming + ")" : "NOT (" + upcoming + ")"}`;
          const params = [session.tenant_id, id, session.branch_id];
          const total = Number(
            (
              await c.query(
                "SELECT count(*) FROM appointments a WHERE " + where,
                params,
              )
            ).rows[0].count,
          );
          const items = (
            await c.query(
              "SELECT a.*,e.name employee_name,b.name branch_name,COALESCE((SELECT string_agg(s.name,', ') FROM appointment_services aps JOIN services s ON s.id=aps.service_id AND s.tenant_id=aps.tenant_id WHERE aps.appointment_id=a.id AND aps.tenant_id=a.tenant_id),'') services FROM appointments a JOIN employees e ON e.id=a.employee_id AND e.tenant_id=a.tenant_id JOIN branches b ON b.id=a.branch_id AND b.tenant_id=a.tenant_id WHERE " +
                where +
                " ORDER BY a.starts_at " +
                (filters.section === "upcoming" ? "ASC" : "DESC") +
                ",a.id LIMIT 25 OFFSET $4",
              [...params, (filters.page - 1) * 25],
            )
          ).rows;
          return { items, total, hasMore: filters.page * 25 < total };
        }),
      );
    }),
  );
  app.get(
    "/api/v1/customers/:id/invoices",
    wrap(async (req, res) => {
      const session = await tenantContext(req, "finance.read");
      await tenantContext(req, "customers.read");
      await feature(session.tenant_id, "pos", session.plan);
      const id = uuid.parse(req.params.id),
        page = z.coerce
          .number()
          .int()
          .min(1)
          .max(100000)
          .default(1)
          .parse(req.query.page);
      ok(
        res,
        await scoped(session.tenant_id, async (c) => {
          if (
            !(
              await c.query(
                "SELECT 1 FROM customers WHERE tenant_id=$1 AND id=$2 AND deleted_at IS NULL",
                [session.tenant_id, id],
              )
            ).rowCount
          )
            throw new HttpError(404, "Customer not found");
          const where =
            "o.tenant_id=$1 AND o.customer_id=$2 AND ($3::uuid IS NULL OR o.branch_id=$3)";
          const params = [session.tenant_id, id, session.branch_id];
          const total = Number(
            (
              await c.query(
                "SELECT count(*) FROM orders o WHERE " + where,
                params,
              )
            ).rows[0].count,
          );
          const items = (
            await c.query(
              "SELECT o.*,b.name branch_name,COALESCE((SELECT sum(amount_minor) FROM payments p WHERE p.tenant_id=o.tenant_id AND p.order_id=o.id),0) paid_minor,COALESCE((SELECT sum(r.amount_minor) FROM refunds r JOIN payments p ON p.id=r.payment_id AND p.tenant_id=r.tenant_id WHERE p.tenant_id=o.tenant_id AND p.order_id=o.id),0) refunded_minor,COALESCE((SELECT json_agg(oi) FROM order_items oi WHERE oi.tenant_id=o.tenant_id AND oi.order_id=o.id),'[]') items FROM orders o JOIN branches b ON b.id=o.branch_id AND b.tenant_id=o.tenant_id WHERE " +
                where +
                " ORDER BY o.created_at DESC,o.id LIMIT 25 OFFSET $4",
              [...params, (page - 1) * 25],
            )
          ).rows;
          return { items, total, hasMore: page * 25 < total };
        }),
      );
    }),
  );
  app.post(
    "/api/v1/customers/:id/messages",
    wrap(async (req, res) => {
      const session = await tenantContext(req, "customers.write");
      const id = uuid.parse(req.params.id);
      const data = z
        .object({
          channel: z.enum(["email", "sms"]),
          subject: z.string().trim().max(200).default(""),
          body: z.string().trim().min(1).max(5000),
          purpose: z.enum(["service", "marketing"]),
          idempotency_key: uuid,
        })
        .superRefine((value, context) => {
          if (value.channel === "email" && !value.subject)
            context.addIssue({
              code: "custom",
              path: ["subject"],
              message: "Enter an email subject",
            });
        })
        .parse(req.body);
      await feature(session.tenant_id, "customers", session.plan);
      await feature(session.tenant_id, data.channel, session.plan);
      if (data.purpose === "marketing") {
        await tenantContext(req, "marketing.write");
        await feature(session.tenant_id, "marketing", session.plan);
      }
      const providers = integrationStatus();
      if (!(data.channel === "email" ? providers.resend : providers.twilio))
        throw new HttpError(
          503,
          data.channel === "email"
            ? "Email delivery is not configured"
            : "SMS delivery is not configured",
        );
      const result = await scoped(session.tenant_id, async (c) => {
        const customer = (
          await c.query(
            "SELECT * FROM customers WHERE tenant_id=$1 AND id=$2 AND deleted_at IS NULL FOR UPDATE",
            [session.tenant_id, id],
          )
        ).rows[0];
        if (!customer) throw new HttpError(404, "Customer not found");
        if (!(data.channel === "email" ? customer.email : customer.phone))
          throw new HttpError(
            422,
            "Customer has no contact address for this channel",
          );
        if (data.purpose === "marketing" && !customer.marketing_consent)
          throw new HttpError(403, "Customer has not opted in to marketing");
        const payload = {
          customer_id: id,
          channel: data.channel,
          subject: data.subject,
          body: data.body,
          purpose: data.purpose,
        };
        const key = "quick:" + session.tenant_id + ":" + data.idempotency_key;
        const existing = (
          await c.query(
            "SELECT id,payload FROM jobs WHERE tenant_id=$1 AND deduplication_key=$2",
            [session.tenant_id, key],
          )
        ).rows[0];
        if (existing) {
          if (
            JSON.stringify(existing.payload) !== JSON.stringify(payload) &&
            Object.keys(payload).some(
              (field) =>
                existing.payload[field] !==
                payload[field as keyof typeof payload],
            )
          )
            throw new HttpError(
              409,
              "This send request was already used for different content",
            );
          return { job_id: existing.id, queued: true };
        }
        const job = (
          await c.query(
            "INSERT INTO jobs(tenant_id,feature_key,type,payload,deduplication_key) VALUES($1,$2,'notification',$3,$4) RETURNING id",
            [
              session.tenant_id,
              data.purpose === "marketing" ? "marketing" : "customers",
              JSON.stringify(payload),
              key,
            ],
          )
        ).rows[0];
        await c.query(
          "INSERT INTO notifications(tenant_id,customer_id,channel,subject,body,job_id) VALUES($1,$2,$3,$4,$5,$6)",
          [
            session.tenant_id,
            id,
            data.channel,
            data.subject,
            data.body,
            job.id,
          ],
        );
        await audit(
          c,
          session.user_id,
          session.tenant_id,
          "customer.message.queued",
          id,
        );
        return { job_id: job.id, queued: true };
      });
      ok(res, result, 201);
    }),
  );
}
