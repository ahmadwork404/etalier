import { portalUrl } from "../services/public-urls.js";
import { validateSlot } from "../services/booking.js";
import type express from "express";
import { z } from "zod";
import { pool, scoped, audit } from "../db.js";
import { wrap, ok, tenantContext, feature, authLimit } from "../runtime.js";
import { HttpError, digest, newToken } from "../security.js";
import { uploadURL, downloadURL, verifyUpload } from "../services/storage.js";
import { validateAnswers } from "../services/intake-validation.js";
const uuid = z.string().uuid();
export const fieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,50}$/),
  label: z.string().min(1).max(200),
  type: z.enum(["text", "textarea", "select", "checkbox", "date", "consent"]),
  required: z.boolean().default(false),
  options: z.array(z.string().max(100)).max(30).optional(),
});
export async function customerToken(token: string, purposes: string[]) {
  const t = (
    await pool.query(
      "SELECT * FROM action_tokens WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() AND (purpose<>'form' OR created_at+interval '24 hours'>now())",
      [digest(token)],
    )
  ).rows[0];
  if (!t || !purposes.includes(t.purpose))
    throw new HttpError(403, "Link is invalid, expired or already used");
  const tenant = (
    await pool.query("SELECT * FROM tenants WHERE id=$1 AND status='active'", [
      t.tenant_id,
    ])
  ).rows[0];
  if (!tenant) throw new HttpError(403, "Salon unavailable");
  await feature(
    t.tenant_id,
    t.purpose === "portal"
      ? "portal"
      : t.purpose === "form"
        ? "forms"
        : t.purpose === "review"
          ? "reviews"
          : "ugc",
    tenant.plan,
  );
  return { ...t, plan: tenant.plan };
}
export function register(app: express.Express) {
  app.patch(
    "/api/v1/customer-link/:token/appointments/:id",
    authLimit,
    wrap(async (req, res) => {
      const t = await customerToken(
          z.string().min(30).max(100).parse(req.params.token),
          ["portal"],
        ),
        id = uuid.parse(req.params.id),
        d = z
          .object({
            action: z.enum(["cancel", "reschedule"]),
            starts_at: z.string().datetime({ offset: true }).optional(),
          })
          .parse(req.body);
      await feature(t.tenant_id, "appointments", t.plan);
      await scoped(t.tenant_id, async (c) => {
        const a = (
          await c.query(
            "SELECT * FROM appointments WHERE tenant_id=$1 AND customer_id=$2 AND id=$3 FOR UPDATE",
            [t.tenant_id, t.customer_id, id],
          )
        ).rows[0];
        if (!a || !["pending", "confirmed"].includes(a.status))
          throw new HttpError(409, "Appointment cannot be changed");
        const rules = (
          await c.query(
            "SELECT cancel_hours,booking_min_hours,booking_max_days FROM tenants WHERE id=$1",
            [t.tenant_id],
          )
        ).rows[0];
        if (
          new Date(a.starts_at).getTime() - Date.now() <
          rules.cancel_hours * 3600000
        )
          throw new HttpError(
            409,
            "The cancellation and rescheduling window has closed; contact the salon",
          );
        if (d.action === "cancel")
          await c.query(
            "UPDATE appointments SET status='cancelled' WHERE tenant_id=$1 AND id=$2",
            [t.tenant_id, id],
          );
        else {
          if (!d.starts_at) throw new HttpError(422, "Choose a new time");
          const start = new Date(d.starts_at),
            advance = start.getTime() - Date.now();
          if (
            advance < rules.booking_min_hours * 3600000 ||
            advance > rules.booking_max_days * 86400000
          )
            throw new HttpError(
              422,
              "New time falls outside the booking window",
            );
          const end = new Date(
            start.getTime() +
              new Date(a.ends_at).getTime() -
              new Date(a.starts_at).getTime(),
          );
          await validateSlot(
            c,
            t.tenant_id,
            a.employee_id,
            a.branch_id,
            start,
            end,
          );
          await c.query(
            "UPDATE appointments SET starts_at=$3,ends_at=$4 WHERE tenant_id=$1 AND id=$2",
            [t.tenant_id, id, start, end],
          );
        }
        await c.query(
          "INSERT INTO audit_logs(tenant_id,action,target_id) VALUES($1,$2,$3)",
          [t.tenant_id, "customer.appointment." + d.action, id],
        );
      });
      ok(res, { updated: true });
    }),
  );
  const specs = {
    forms: {
      feature: "forms",
      permission: "forms",
      schema: z.object({
        name: z.string().min(2).max(120),
        fields: z
          .array(fieldSchema)
          .min(1)
          .max(50)
          .refine(
            (fs) => new Set(fs.map((f) => f.key)).size === fs.length,
            "Question keys must be unique",
          ),
      }),
    },
    workflows: {
      feature: "automations",
      permission: "marketing",
      schema: z.object({
        name: z.string().min(2).max(120),
        trigger: z.enum(["appointment.created", "appointment.completed"]),
        channel: z.enum(["email", "sms", "whatsapp"]),
        delay_minutes: z.number().int().min(0).max(525600),
        subject: z.string().min(1).max(200),
        body: z.string().min(1).max(5000),
        enabled: z.boolean().default(false),
      }),
    },
    campaigns: {
      feature: "marketing",
      permission: "marketing",
      schema: z.object({
        name: z.string().min(2).max(120),
        channel: z.enum(["email", "sms", "whatsapp"]),
        subject: z.string().min(1).max(200),
        body: z.string().min(1).max(5000),
      }),
    },
  };
  for (const [name, spec] of Object.entries(specs)) {
    app.get(
      "/api/v1/" + name,
      wrap(async (req, res) => {
        const s = await tenantContext(req, spec.permission + ".read");
        await feature(s.tenant_id, spec.feature, s.plan);
        ok(
          res,
          await scoped(
            s.tenant_id,
            async (c) =>
              (
                await c.query(
                  `SELECT * FROM ${name} WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 100`,
                  [s.tenant_id],
                )
              ).rows,
          ),
        );
      }),
    );
    app.post(
      "/api/v1/" + name,
      wrap(async (req, res) => {
        const s = await tenantContext(req, spec.permission + ".write");
        await feature(s.tenant_id, spec.feature, s.plan);
        const d = spec.schema.parse(req.body) as any;
        const keys = Object.keys(d);
        ok(
          res,
          await scoped(s.tenant_id, async (c) => {
            const row = (
              await c.query(
                `INSERT INTO ${name}(tenant_id,${keys.join(",")}) VALUES($1,${keys.map((_, i) => "$" + (i + 2)).join(",")}) RETURNING *`,
                [
                  s.tenant_id,
                  ...Object.entries(d).map(([k, v]) =>
                    k === "fields" ? JSON.stringify(v) : v,
                  ),
                ],
              )
            ).rows[0];
            await audit(c, s.user_id, s.tenant_id, name + ".created", row.id);
            return row;
          }),
          201,
        );
      }),
    );
  }
  for (const [table, permission, key] of [
    ["form_submissions", "forms", "forms"],
    ["reviews", "reviews", "reviews"],
    ["ugc_submissions", "ugc", "ugc"],
    ["notifications", "marketing", "marketing"],
  ])
    app.get(
      "/api/v1/" + table.replaceAll("_", "-"),
      wrap(async (req, res) => {
        const s = await tenantContext(req, permission + ".read");
        await feature(s.tenant_id, key, s.plan);
        ok(
          res,
          await scoped(
            s.tenant_id,
            async (c) =>
              (
                await c.query(
                  `SELECT t.*,cu.name customer_name FROM ${table} t JOIN customers cu ON cu.id=t.customer_id AND cu.tenant_id=t.tenant_id WHERE t.tenant_id=$1 ORDER BY t.created_at DESC LIMIT 100`,
                  [s.tenant_id],
                )
              ).rows,
          ),
        );
      }),
    );
  app.post(
    "/api/v1/customer-links",
    wrap(async (req, res) => {
      const d = z
          .object({
            customer_id: uuid,
            purpose: z.enum(["form", "review", "ugc", "portal"]),
            resource_id: uuid.optional(),
          })
          .parse(req.body),
        permission =
          d.purpose === "form"
            ? "forms"
            : d.purpose === "portal"
              ? "customers"
              : d.purpose === "review"
                ? "reviews"
                : "ugc";
      const s = await tenantContext(req, permission + ".write");
      await feature(
        s.tenant_id,
        d.purpose === "form"
          ? "forms"
          : d.purpose === "review"
            ? "reviews"
            : d.purpose,
        s.plan,
      );
      const token = newToken();
      await scoped(s.tenant_id, async (c) => {
        if (
          !(
            await c.query(
              "SELECT 1 FROM customers WHERE tenant_id=$1 AND id=$2 AND deleted_at IS NULL",
              [s.tenant_id, d.customer_id],
            )
          ).rowCount
        )
          throw new HttpError(404, "Customer not found");
        if (
          d.purpose === "form" &&
          (!d.resource_id ||
            !(
              await c.query(
                "SELECT 1 FROM forms WHERE tenant_id=$1 AND id=$2 AND active",
                [s.tenant_id, d.resource_id],
              )
            ).rowCount)
        )
          throw new HttpError(422, "Select an active form");
        await c.query(
          "INSERT INTO action_tokens(token_hash,purpose,tenant_id,customer_id,resource_id,expires_at) VALUES($1,$2,$3,$4,$5,now()+CASE WHEN $2='form' THEN interval '24 hours' ELSE interval '7 days' END)",
          [
            digest(token),
            d.purpose,
            s.tenant_id,
            d.customer_id,
            d.resource_id || null,
          ],
        );
        await audit(
          c,
          s.user_id,
          s.tenant_id,
          "customer_link.created",
          d.customer_id,
        );
      });
      ok(
        res,
        {
          url: portalUrl() + "/customer?token=" + token,
          purpose: d.purpose,
        },
        201,
      );
    }),
  );
  app.get(
    "/api/v1/customer-link/:token",
    authLimit,
    wrap(async (req, res) => {
      const t = await customerToken(
        z.string().min(30).max(100).parse(req.params.token),
        ["form", "review", "ugc", "portal"],
      );
      ok(
        res,
        await scoped(t.tenant_id, async (c) => {
          const salon = (
            await c.query(
              "SELECT name,brand_color,currency FROM tenants WHERE id=$1",
              [t.tenant_id],
            )
          ).rows[0];
          const customer = (
            await c.query(
              "SELECT name,marketing_consent,preferred_channel FROM customers WHERE tenant_id=$1 AND id=$2 AND deleted_at IS NULL",
              [t.tenant_id, t.customer_id],
            )
          ).rows[0];
          if (!customer)
            throw new HttpError(404, "Customer no longer available");
          let form, appointments;
          if (t.purpose === "form")
            form = (
              await c.query(
                "SELECT name,fields FROM forms WHERE tenant_id=$1 AND id=$2",
                [t.tenant_id, t.resource_id],
              )
            ).rows[0];
          if (t.purpose === "portal")
            appointments = (
              await c.query(
                "SELECT id,starts_at,ends_at,status FROM appointments WHERE tenant_id=$1 AND customer_id=$2 ORDER BY starts_at DESC LIMIT 100",
                [t.tenant_id, t.customer_id],
              )
            ).rows;
          return { purpose: t.purpose, salon, customer, form, appointments };
        }),
      );
    }),
  );
  app.post(
    "/api/v1/customer-link/:token",
    authLimit,
    wrap(async (req, res) => {
      const token = z.string().min(30).max(100).parse(req.params.token),
        t = await customerToken(token, ["form", "review", "ugc", "portal"]);
      await scoped(t.tenant_id, async (c) => {
        const locked = (
          await c.query(
            "SELECT * FROM action_tokens WHERE id=$1 AND used_at IS NULL AND expires_at>now() FOR UPDATE",
            [t.id],
          )
        ).rows[0];
        if (!locked) throw new HttpError(403, "Link expired or already used");
        if (t.purpose === "form") {
          const { answers } = z
            .object({
              answers: z.record(
                z.string(),
                z.union([z.string().max(5000), z.boolean()]),
              ),
            })
            .parse(req.body);
          const f = (
            await c.query(
              "SELECT fields FROM forms WHERE tenant_id=$1 AND id=$2 AND active",
              [t.tenant_id, t.resource_id],
            )
          ).rows[0];
          if (!f) throw new HttpError(404, "Form unavailable");
          let safe;
          try {
            safe = validateAnswers(f.fields, answers);
          } catch (error) {
            throw new HttpError(422, (error as Error).message);
          }
          await c.query(
            "INSERT INTO form_submissions(tenant_id,form_id,customer_id,answers) VALUES($1,$2,$3,$4)",
            [t.tenant_id, t.resource_id, t.customer_id, JSON.stringify(safe)],
          );
        }
        if (t.purpose === "review") {
          const d = z
            .object({
              rating: z.number().int().min(1).max(5),
              body: z.string().max(5000),
            })
            .parse(req.body);
          await c.query(
            "INSERT INTO reviews(tenant_id,customer_id,rating,body) VALUES($1,$2,$3,$4)",
            [t.tenant_id, t.customer_id, d.rating, d.body],
          );
        }
        if (t.purpose === "ugc") {
          const d = z
            .object({
              testimonial: z.string().max(5000),
              media_id: uuid.optional(),
              consent_granted: z.boolean(),
              consent_text: z.string().min(10).max(1000),
            })
            .refine((d) => d.testimonial.length > 0 || d.media_id)
            .parse(req.body);
          if (
            d.media_id &&
            !(
              await c.query(
                "SELECT 1 FROM media WHERE tenant_id=$1 AND customer_id=$2 AND id=$3 AND verified",
                [t.tenant_id, t.customer_id, d.media_id],
              )
            ).rowCount
          )
            throw new HttpError(422, "Media must be verified first");
          await c.query(
            "INSERT INTO ugc_submissions(tenant_id,customer_id,media_id,testimonial,consent_granted,consent_text) VALUES($1,$2,$3,$4,$5,$6)",
            [
              t.tenant_id,
              t.customer_id,
              d.media_id || null,
              d.testimonial,
              d.consent_granted,
              d.consent_text,
            ],
          );
          await c.query(
            "INSERT INTO consent_records(tenant_id,customer_id,purpose,granted) VALUES($1,$2,'ugc_marketing',$3)",
            [t.tenant_id, t.customer_id, d.consent_granted],
          );
        }
        if (t.purpose === "portal") {
          const d = z
            .object({
              marketing_consent: z.boolean(),
              preferred_channel: z.enum(["email", "sms", "whatsapp", "none"]),
            })
            .parse(req.body);
          await c.query(
            "UPDATE customers SET marketing_consent=$3,preferred_channel=$4 WHERE tenant_id=$1 AND id=$2",
            [
              t.tenant_id,
              t.customer_id,
              d.marketing_consent,
              d.preferred_channel,
            ],
          );
          await c.query(
            "INSERT INTO consent_records(tenant_id,customer_id,purpose,granted) VALUES($1,$2,'marketing',$3)",
            [t.tenant_id, t.customer_id, d.marketing_consent],
          );
          return;
        }
        await c.query("UPDATE action_tokens SET used_at=now() WHERE id=$1", [
          t.id,
        ]);
      });
      ok(res, { submitted: true });
    }),
  );
  app.post(
    "/api/v1/customer-link/:token/upload",
    authLimit,
    wrap(async (req, res) => {
      const t = await customerToken(
        z.string().min(30).max(100).parse(req.params.token),
        ["ugc"],
      );
      const d = z
          .object({
            content_type: z.enum([
              "image/jpeg",
              "image/png",
              "image/webp",
              "video/mp4",
            ]),
            size_bytes: z
              .number()
              .int()
              .positive()
              .max(50 * 1024 * 1024),
          })
          .parse(req.body),
        id = crypto.randomUUID(),
        key = t.tenant_id + "/" + t.customer_id + "/" + id;
      const url = await uploadURL(key, d.content_type, d.size_bytes);
      await scoped(t.tenant_id, async (c) => {
        if (
          Number(
            (
              await c.query(
                "SELECT count(*) FROM media WHERE tenant_id=$1 AND customer_id=$2",
                [t.tenant_id, t.customer_id],
              )
            ).rows[0].count,
          ) >= 50
        )
          throw new HttpError(429, "Upload limit reached");
        await c.query(
          "INSERT INTO media(id,tenant_id,customer_id,object_key,content_type,size_bytes) VALUES($1,$2,$3,$4,$5,$6)",
          [id, t.tenant_id, t.customer_id, key, d.content_type, d.size_bytes],
        );
      });
      ok(res, { media_id: id, url, expiresInSeconds: 300 }, 201);
    }),
  );
  app.post(
    "/api/v1/customer-link/:token/upload/:id/verify",
    authLimit,
    wrap(async (req, res) => {
      const t = await customerToken(
          z.string().min(30).max(100).parse(req.params.token),
          ["ugc"],
        ),
        id = uuid.parse(req.params.id);
      const media = await scoped(
        t.tenant_id,
        async (c) =>
          (
            await c.query(
              "SELECT * FROM media WHERE tenant_id=$1 AND customer_id=$2 AND id=$3",
              [t.tenant_id, t.customer_id, id],
            )
          ).rows[0],
      );
      if (!media) throw new HttpError(404, "Upload not found");
      await verifyUpload(
        media.object_key,
        media.content_type,
        Number(media.size_bytes),
      );
      await scoped(t.tenant_id, async (c) => {
        await c.query(
          "UPDATE media SET verified=true WHERE tenant_id=$1 AND id=$2",
          [t.tenant_id, id],
        );
      });
      ok(res, { verified: true });
    }),
  );
  app.patch(
    "/api/v1/reviews/:id",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "reviews.write");
      await feature(s.tenant_id, "reviews", s.plan);
      const id = uuid.parse(req.params.id),
        d = z.object({ response: z.string().min(1).max(5000) }).parse(req.body);
      await scoped(s.tenant_id, async (c) => {
        if (
          !(
            await c.query(
              "UPDATE reviews SET response=$3 WHERE tenant_id=$1 AND id=$2",
              [s.tenant_id, id, d.response],
            )
          ).rowCount
        )
          throw new HttpError(404, "Review not found");
        await audit(c, s.user_id, s.tenant_id, "review.responded", id);
      });
      ok(res, { updated: true });
    }),
  );
  app.patch(
    "/api/v1/ugc/:id",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "ugc.write");
      await feature(s.tenant_id, "ugc", s.plan);
      const id = uuid.parse(req.params.id),
        d = z
          .object({ status: z.enum(["approved", "rejected", "withdrawn"]) })
          .parse(req.body);
      await scoped(s.tenant_id, async (c) => {
        const r = await c.query(
          "UPDATE ugc_submissions SET status=$3 WHERE tenant_id=$1 AND id=$2 AND ($3<>'approved' OR (consent_granted AND status<>'withdrawn' AND (consent_expires_at IS NULL OR consent_expires_at>now())))",
          [s.tenant_id, id, d.status],
        );
        if (!r.rowCount)
          throw new HttpError(
            403,
            "Content is unavailable or lacks valid consent",
          );
        await audit(c, s.user_id, s.tenant_id, "ugc." + d.status, id);
      });
      ok(res, { updated: true });
    }),
  );
  app.get(
    "/api/v1/ugc/:id/download",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "ugc.read");
      await feature(s.tenant_id, "ugc", s.plan);
      const id = uuid.parse(req.params.id);
      const row = await scoped(
        s.tenant_id,
        async (c) =>
          (
            await c.query(
              "SELECT m.object_key FROM ugc_submissions u JOIN media m ON m.id=u.media_id AND m.tenant_id=u.tenant_id WHERE u.tenant_id=$1 AND u.id=$2 AND u.status='approved' AND u.consent_granted AND m.verified AND (u.consent_expires_at IS NULL OR u.consent_expires_at>now())",
              [s.tenant_id, id],
            )
          ).rows[0],
      );
      if (!row)
        throw new HttpError(403, "No approved media with current consent");
      ok(res, { url: await downloadURL(row.object_key) });
    }),
  );
}
