import type express from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { pool, transaction } from "../db.js";
import { digest, HttpError } from "../security.js";
import { wrap, ok, platform } from "../runtime.js";

const line = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(
      (value) => !/[\x00-\x1f\x7f<>]/.test(value),
      "Use plain text on one line",
    );
export const contactSchema = z
  .object({
    request_key: z.string().uuid(),
    name: line(100).min(2),
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    salon_name: line(160).default(""),
    phone: line(40).default(""),
    team_size: z
      .enum(["", "Just me", "2–5", "6–15", "16–30", "31+"])
      .default(""),
    message: z
      .string()
      .trim()
      .min(10)
      .max(5000)
      .refine(
        (value) => !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f<>]/.test(value),
        "Use plain text without markup",
      ),
    consent: z.literal(true),
    website: z.string().max(200).default(""),
  })
  .strict();
const status = z.enum(["new", "contacted", "qualified", "closed", "spam"]);
export function register(app: express.Express) {
  app.post(
    "/api/v1/contact-leads",
    rateLimit({
      windowMs: 60000,
      limit: 30,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        error: {
          message: "Too many enquiries. Please wait a minute and try again.",
        },
      },
    }),
    wrap(async (req, res) => {
      const d = contactSchema.parse(req.body);
      if (d.website) return ok(res, { received: true }, 202);
      const hash = digest(JSON.stringify({ ...d, request_key: undefined }));
      await transaction(async (c) => {
        // Serialize repeated requests from the same address, including concurrent retries.
        await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
          d.email,
        ]);
        const existing = (
          await c.query(
            "SELECT payload_hash FROM contact_leads WHERE request_key=$1",
            [d.request_key],
          )
        ).rows[0];
        if (existing) {
          if (existing.payload_hash !== hash)
            throw new HttpError(
              409,
              "This submission has changed. Refresh the page and try again.",
            );
          return;
        }
        const count = (
          await c.query(
            "SELECT count(*)::integer total FROM contact_leads WHERE email=$1 AND created_at>now()-interval '1 hour'",
            [d.email],
          )
        ).rows[0].total;
        if (count >= 3)
          throw new HttpError(
            429,
            "Your enquiry has been received. Please allow time for a reply before sending another.",
          );
        await c.query(
          "INSERT INTO contact_leads(request_key,payload_hash,name,email,salon_name,phone,team_size,message) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            d.request_key,
            hash,
            d.name,
            d.email,
            d.salon_name,
            d.phone,
            d.team_size,
            d.message,
          ],
        );
      });
      ok(res, { received: true }, 202);
    }),
  );
  app.get(
    "/api/v1/admin/leads",
    wrap(async (req, res) => {
      await platform(req);
      const q = z
          .string()
          .max(200)
          .parse(req.query.q || ""),
        filter = z.union([status, z.literal("")]).parse(req.query.status || ""),
        page = z.coerce
          .number()
          .int()
          .min(1)
          .max(100000)
          .parse(req.query.page || 1);
      const params = [q, filter];
      const where =
        "WHERE ($1='' OR concat_ws(' ',name,email,salon_name) ILIKE '%'||$1||'%') AND ($2='' OR status=$2)";
      const [rows, count, summary] = await Promise.all([
        pool.query(
          `SELECT id,name,email,salon_name,status,notification_status,created_at FROM contact_leads ${where} ORDER BY created_at DESC LIMIT 25 OFFSET $3`,
          [...params, (page - 1) * 25],
        ),
        pool.query(
          `SELECT count(*)::integer total FROM contact_leads ${where}`,
          params,
        ),
        pool.query(
          "SELECT count(*)::integer total,count(*) FILTER(WHERE status='new')::integer new,count(*) FILTER(WHERE status='qualified')::integer qualified,count(*) FILTER(WHERE notification_status='failed')::integer failed FROM contact_leads",
        ),
      ]);
      ok(res, {
        items: rows.rows,
        total: count.rows[0].total,
        summary: summary.rows[0],
        page,
      });
    }),
  );
  app.get(
    "/api/v1/admin/leads/:id",
    wrap(async (req, res) => {
      await platform(req);
      const id = z.string().uuid().parse(req.params.id);
      const lead = (
        await pool.query("SELECT * FROM contact_leads WHERE id=$1", [id])
      ).rows[0];
      if (!lead) throw new HttpError(404, "Enquiry not found");
      const { payload_hash, request_key, ...visible } = lead;
      ok(res, visible);
    }),
  );
  app.patch(
    "/api/v1/admin/leads/:id",
    wrap(async (req, res) => {
      const admin = await platform(req),
        id = z.string().uuid().parse(req.params.id);
      const d = z
        .object({ status, admin_notes: z.string().trim().max(10000) })
        .strict()
        .parse(req.body);
      await transaction(async (c) => {
        if (
          !(
            await c.query(
              "UPDATE contact_leads SET status=$2,admin_notes=$3,updated_at=now() WHERE id=$1 RETURNING id",
              [id, d.status, d.admin_notes],
            )
          ).rowCount
        )
          throw new HttpError(404, "Enquiry not found");
        await c.query(
          "INSERT INTO audit_logs(actor_id,tenant_id,action,target_id) VALUES($1,NULL,'lead.updated',$2)",
          [admin.user_id, id],
        );
      });
      ok(res, { saved: true });
    }),
  );
  app.post(
    "/api/v1/admin/leads/:id/retry",
    wrap(async (req, res) => {
      await platform(req);
      const id = z.string().uuid().parse(req.params.id);
      const result = await pool.query(
        "UPDATE contact_leads SET notification_status='pending',notification_attempts=0,next_attempt_at=now(),notification_error=NULL WHERE id=$1 AND notification_status='failed' RETURNING id",
        [id],
      );
      if (!result.rowCount)
        throw new HttpError(409, "Only failed notifications can be retried.");
      ok(res, { queued: true }, 202);
    }),
  );
}
