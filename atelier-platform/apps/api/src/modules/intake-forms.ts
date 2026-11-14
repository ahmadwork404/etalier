import { portalUrl } from "../services/public-urls.js";
import type express from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { pool, scoped, audit } from "../db.js";
import { wrap, ok, tenantContext, feature } from "../runtime.js";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { HttpError, digest, newToken } from "../security.js";
import {
  intakeDefinition,
  plainText,
  validateAnswers,
  deviceSummary,
} from "../services/intake-validation.js";
import { integrationStatus, sendEmail } from "../services/providers.js";
import { photoURL } from "../services/storage.js";
const uuid = z.string().uuid();
const intakeLimit = rateLimit({
  windowMs: 60000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) =>
    ipKeyGenerator(req.ip || "") +
    ":" +
    digest(String(req.params.token)).slice(0, 24),
  message: {
    error: {
      message: "Please wait a minute before trying this form link again.",
    },
  },
});
const publicURL = (token: string) => portalUrl() + "/intake/" + token;
async function access(req: express.Request, write = false) {
  const s = await tenantContext(req, write ? "forms.write" : "forms.read");
  await feature(s.tenant_id, "forms", s.plan);
  return s;
}
export function register(app: express.Express) {
  app.get(
    "/api/v1/intake-responses/:id/photo",
    wrap(async (req, res) => {
      const s = await access(req),
        id = uuid.parse(req.params.id);
      const media = await scoped(
        s.tenant_id,
        async (c) =>
          (
            await c.query(
              "SELECT m.object_key FROM form_submissions r JOIN customers cu ON cu.tenant_id=r.tenant_id AND cu.id=r.customer_id JOIN media m ON m.tenant_id=cu.tenant_id AND m.id=cu.photo_media_id AND m.customer_id=cu.id WHERE r.tenant_id=$1 AND r.id=$2 AND cu.deleted_at IS NULL AND m.verified AND m.purpose='customer_photo'",
              [s.tenant_id, id],
            )
          ).rows[0],
      );
      if (!media) throw new HttpError(404, "Customer photo not found");
      res.redirect(await photoURL(media.object_key));
    }),
  );
  app.get(
    "/api/v1/intake-forms",
    wrap(async (req, res) => {
      const s = await access(req);
      ok(
        res,
        await scoped(
          s.tenant_id,
          async (c) =>
            (
              await c.query(
                `SELECT f.*, (SELECT count(*)::integer FROM form_submissions r WHERE r.tenant_id=f.tenant_id AND r.form_id=f.id) response_count,(SELECT count(*)::integer FROM form_submissions r WHERE r.tenant_id=f.tenant_id AND r.form_id=f.id AND NOT r.reviewed) unreviewed_count FROM forms f WHERE f.tenant_id=$1 ORDER BY f.created_at DESC LIMIT 200`,
                [s.tenant_id],
              )
            ).rows,
        ),
      );
    }),
  );
  app.post(
    "/api/v1/intake-forms",
    wrap(async (req, res) => {
      const s = await access(req, true),
        d = intakeDefinition.parse(req.body),
        token = newToken();
      const result = await scoped(s.tenant_id, async (c) => {
        const form = (
          await c.query(
            "INSERT INTO forms(tenant_id,name,description,fields,active) VALUES($1,$2,$3,$4,$5) RETURNING *",
            [
              s.tenant_id,
              d.name,
              d.description,
              JSON.stringify(d.fields),
              d.active,
            ],
          )
        ).rows[0];
        let link = null;
        if (d.active) {
          link = (
            await c.query(
              `INSERT INTO intake_links(tenant_id,form_id,token_hash,fields_snapshot,name_snapshot,description_snapshot,expires_at,delivery,request_key) VALUES($1,$2,$3,$4,$5,$6,now()+interval '24 hours','copy',$7) RETURNING id,expires_at,max_uses`,
              [
                s.tenant_id,
                form.id,
                digest(token),
                JSON.stringify(d.fields),
                d.name,
                d.description,
                randomUUID(),
              ],
            )
          ).rows[0];
          await c.query(
            "INSERT INTO action_tokens(token_hash,purpose,tenant_id,resource_id,expires_at) VALUES($1,'intake_form',$2,$3,$4)",
            [digest(token), s.tenant_id, link.id, link.expires_at],
          );
        }
        await audit(c, s.user_id, s.tenant_id, "intake.created", form.id);
        return { form, link: link ? { ...link, url: publicURL(token) } : null };
      });
      ok(res, result, 201);
    }),
  );
  app.get(
    "/api/v1/intake-forms/:id",
    wrap(async (req, res) => {
      const s = await access(req),
        id = uuid.parse(req.params.id);
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const form = (
            await c.query("SELECT * FROM forms WHERE tenant_id=$1 AND id=$2", [
              s.tenant_id,
              id,
            ])
          ).rows[0];
          if (!form) throw new HttpError(404, "Form not found");
          const links = (
            await c.query(
              `SELECT l.id,l.customer_id,cu.name customer_name,l.expires_at,l.max_uses,l.uses,l.revoked_at,l.delivery,l.delivery_status,l.created_at,CASE WHEN l.revoked_at IS NOT NULL THEN 'revoked' WHEN l.expires_at<=now() THEN 'expired' WHEN l.uses>=l.max_uses THEN 'used' ELSE 'active' END status FROM intake_links l LEFT JOIN customers cu ON cu.tenant_id=l.tenant_id AND cu.id=l.customer_id WHERE l.tenant_id=$1 AND l.form_id=$2 ORDER BY l.created_at DESC LIMIT 200`,
              [s.tenant_id, id],
            )
          ).rows;
          const responses = (
            await c.query(
              `SELECT r.id,r.customer_id,cu.photo_media_id,COALESCE(r.respondent_name,cu.name,'Customer') customer_name,r.reviewed,r.created_at,r.device FROM form_submissions r LEFT JOIN customers cu ON cu.id=r.customer_id AND cu.tenant_id=r.tenant_id WHERE r.tenant_id=$1 AND r.form_id=$2 ORDER BY r.created_at DESC LIMIT 200`,
              [s.tenant_id, id],
            )
          ).rows;
          const summary = (
            await c.query(
              "SELECT count(*)::integer responses,count(*) FILTER(WHERE NOT reviewed)::integer unreviewed FROM form_submissions WHERE tenant_id=$1 AND form_id=$2",
              [s.tenant_id, id],
            )
          ).rows[0];
          return {
            form,
            links,
            responses,
            summary,
            email_configured: integrationStatus().resend,
          };
        }),
      );
    }),
  );
  app.patch(
    "/api/v1/intake-forms/:id",
    wrap(async (req, res) => {
      const s = await access(req, true),
        id = uuid.parse(req.params.id),
        d = intakeDefinition.parse(req.body);
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const row = (
            await c.query(
              "UPDATE forms SET name=$3,description=$4,fields=$5,active=$6,updated_at=now() WHERE tenant_id=$1 AND id=$2 RETURNING *",
              [
                s.tenant_id,
                id,
                d.name,
                d.description,
                JSON.stringify(d.fields),
                d.active,
              ],
            )
          ).rows[0];
          if (!row) throw new HttpError(404, "Form not found");
          await audit(c, s.user_id, s.tenant_id, "intake.updated", id);
          return row;
        }),
      );
    }),
  );
  app.get(
    "/api/v1/intake-forms/:id/responses",
    wrap(async (req, res) => {
      const s = await access(req),
        id = uuid.parse(req.params.id);
      const { page, q } = z
        .object({
          page: z.coerce.number().int().min(1).max(100000).default(1),
          q: z.string().max(100).default(""),
        })
        .parse(req.query);
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          if (
            !(
              await c.query(
                "SELECT 1 FROM forms WHERE tenant_id=$1 AND id=$2",
                [s.tenant_id, id],
              )
            ).rowCount
          )
            throw new HttpError(404, "Form not found");
          const from =
            "FROM form_submissions r LEFT JOIN customers cu ON cu.id=r.customer_id AND cu.tenant_id=r.tenant_id WHERE r.tenant_id=$1 AND r.form_id=$2 AND COALESCE(r.respondent_name,cu.name,'Customer') ILIKE $3";
          const args = [s.tenant_id, id, "%" + q + "%"];
          const total = Number(
            (await c.query("SELECT count(*) " + from, args)).rows[0].count,
          );
          const items = (
            await c.query(
              "SELECT r.id,r.customer_id,cu.photo_media_id,COALESCE(r.respondent_name,cu.name,'Customer') customer_name,r.reviewed,r.created_at,r.device " +
                from +
                " ORDER BY r.created_at DESC,r.id DESC LIMIT 25 OFFSET $4",
              [...args, (page - 1) * 25],
            )
          ).rows;
          return { items, total, hasMore: page * 25 < total };
        }),
      );
    }),
  );
  app.post(
    "/api/v1/intake-forms/:id/links",
    wrap(async (req, res) => {
      const s = await access(req, true),
        formId = uuid.parse(req.params.id);
      const d = z
        .object({
          delivery: z.enum(["copy", "email"]),
          customer_ids: z.array(uuid).max(50).default([]),
          expires_hours: z.number().int().min(1).max(48).default(24),
          max_uses: z.number().int().min(1).max(100).default(1),
          request_key: uuid,
        })
        .strict()
        .parse(req.body);
      if (d.delivery === "copy" && d.expires_hours > 24)
        throw new HttpError(422, "Copyable links can last at most 24 hours.");
      if (d.max_uses > 1 && !s.is_owner)
        throw new HttpError(
          403,
          "Only the salon owner can allow multiple submissions per link.",
        );
      if (d.customer_ids.length) await tenantContext(req, "customers.read");
      if (new Set(d.customer_ids).size !== d.customer_ids.length)
        throw new HttpError(422, "Choose each customer once.");
      if (d.delivery === "email") {
        await tenantContext(req, "customers.read");
        await feature(s.tenant_id, "email", s.plan);
        if (!d.customer_ids.length)
          throw new HttpError(422, "Select at least one customer.");
        if (!integrationStatus().resend)
          throw new HttpError(503, "Email delivery is not configured.");
      }
      const results = await scoped(s.tenant_id, async (c) => {
        if (
          (
            await c.query(
              "SELECT 1 FROM intake_links WHERE tenant_id=$1 AND request_key=$2",
              [s.tenant_id, d.request_key],
            )
          ).rowCount
        )
          throw new HttpError(
            409,
            "This link request has already been processed. Refresh the delivery history.",
          );
        const form = (
          await c.query(
            "SELECT * FROM forms WHERE tenant_id=$1 AND id=$2 AND active FOR SHARE",
            [s.tenant_id, formId],
          )
        ).rows[0];
        if (!form) throw new HttpError(404, "Choose an active form.");
        const recipients = d.customer_ids.length
          ? (
              await c.query(
                "SELECT id,name,email,preferred_channel FROM customers WHERE tenant_id=$1 AND id=ANY($2::uuid[]) AND deleted_at IS NULL",
                [s.tenant_id, d.customer_ids],
              )
            ).rows
          : [{ id: null, name: "Anyone with this link", email: null }];
        if (
          d.customer_ids.length &&
          recipients.length !== d.customer_ids.length
        )
          throw new HttpError(422, "One or more customers are unavailable.");
        if (
          d.delivery === "email" &&
          recipients.some(
            (customer) =>
              !customer.email || customer.preferred_channel === "none",
          )
        )
          throw new HttpError(
            422,
            "Every selected customer needs an email and must allow contact.",
          );
        const links = [];
        for (const customer of recipients) {
          const token = newToken();
          const link = (
            await c.query(
              `INSERT INTO intake_links(tenant_id,form_id,customer_id,token_hash,fields_snapshot,name_snapshot,description_snapshot,expires_at,max_uses,delivery,delivery_status,request_key) VALUES($1,$2,$3,$4,$5,$6,$7,now()+$8*interval '1 hour',$9,$10,$11,$12) RETURNING id,expires_at,max_uses`,
              [
                s.tenant_id,
                formId,
                customer.id,
                digest(token),
                JSON.stringify(form.fields),
                form.name,
                form.description,
                d.expires_hours,
                d.max_uses,
                d.delivery,
                d.delivery === "email" ? "sending" : "copy",
                d.request_key,
              ],
            )
          ).rows[0];
          await c.query(
            "INSERT INTO action_tokens(token_hash,purpose,tenant_id,customer_id,resource_id,expires_at) VALUES($1,'intake_form',$2,$3,$4,$5)",
            [digest(token), s.tenant_id, customer.id, link.id, link.expires_at],
          );
          links.push({
            ...link,
            url: publicURL(token),
            customer_name: customer.name,
            email: customer.email,
            form_name: form.name,
          });
        }
        await audit(c, s.user_id, s.tenant_id, "intake.links.created", formId);
        return links;
      });
      const deliveries = [];
      // Only the recipients explicitly selected in this request are contacted.
      for (const link of results) {
        let status = "copy";
        if (d.delivery === "email") {
          try {
            await sendEmail(
              link.email,
              `Please complete ${link.form_name}`,
              `Hello ${link.customer_name},\n\nPlease complete this intake form: ${link.url}\n\nThis private link expires ${new Date(link.expires_at).toISOString()} and allows ${link.max_uses} submission(s).`,
              link.id,
              {
                content: {
                  title: link.form_name,
                  preview: "Your salon has sent you an intake form.",
                  paragraphs: [
                    `Hello ${link.customer_name},`,
                    "Please complete this form before your visit so your salon can prepare for you.",
                    `This private link expires on ${new Date(link.expires_at).toLocaleString("en-GB", { timeZone: "UTC" })} UTC. It allows ${link.max_uses === 1 ? "one submission" : `${link.max_uses} submissions`}. Please do not forward it.`,
                  ],
                  action: { label: "Complete form", url: link.url },
                  footer:
                    "You received this form because your salon selected you as a recipient. Contact your salon if you were not expecting it.",
                },
              },
            );
            status = "sent";
          } catch {
            status = "failed";
          }
          await scoped(s.tenant_id, async (c) => {
            await c.query(
              "UPDATE intake_links SET delivery_status=$3 WHERE tenant_id=$1 AND id=$2",
              [s.tenant_id, link.id, status],
            );
          });
        }
        deliveries.push({
          id: link.id,
          url: link.url,
          customer_name: link.customer_name,
          expires_at: link.expires_at,
          max_uses: link.max_uses,
          status,
        });
      }
      ok(res, deliveries, 201);
    }),
  );
  app.post(
    "/api/v1/intake-forms/:id/links/:linkId/revoke",
    wrap(async (req, res) => {
      const s = await access(req, true),
        id = uuid.parse(req.params.id),
        link = uuid.parse(req.params.linkId);
      await scoped(s.tenant_id, async (c) => {
        const result = await c.query(
          "UPDATE intake_links SET revoked_at=COALESCE(revoked_at,now()) WHERE tenant_id=$1 AND form_id=$2 AND id=$3 RETURNING id",
          [s.tenant_id, id, link],
        );
        if (!result.rowCount) throw new HttpError(404, "Link not found");
        await audit(c, s.user_id, s.tenant_id, "intake.link.revoked", link);
      });
      ok(res, { revoked: true });
    }),
  );
  app.get(
    "/api/v1/intake-responses/:id",
    wrap(async (req, res) => {
      const s = await access(req),
        id = uuid.parse(req.params.id);
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const response = (
            await c.query(
              `SELECT r.*,cu.photo_media_id,COALESCE(r.respondent_name,cu.name,'Customer') customer_name,COALESCE(r.respondent_email,cu.email) customer_email,COALESCE(r.fields_snapshot,f.fields) questions,f.name form_name FROM form_submissions r JOIN forms f ON f.id=r.form_id AND f.tenant_id=r.tenant_id LEFT JOIN customers cu ON cu.id=r.customer_id AND cu.tenant_id=r.tenant_id WHERE r.tenant_id=$1 AND r.id=$2`,
              [s.tenant_id, id],
            )
          ).rows[0];
          if (!response) throw new HttpError(404, "Response not found");
          return response;
        }),
      );
    }),
  );
  app.patch(
    "/api/v1/intake-responses/:id",
    wrap(async (req, res) => {
      const s = await access(req, true),
        id = uuid.parse(req.params.id),
        d = z.object({ reviewed: z.boolean() }).strict().parse(req.body);
      await scoped(s.tenant_id, async (c) => {
        if (
          !(
            await c.query(
              "UPDATE form_submissions SET reviewed=$3 WHERE tenant_id=$1 AND id=$2 RETURNING id",
              [s.tenant_id, id, d.reviewed],
            )
          ).rowCount
        )
          throw new HttpError(404, "Response not found");
        await audit(c, s.user_id, s.tenant_id, "intake.response.reviewed", id);
      });
      ok(res, d);
    }),
  );
  async function discover(token: string) {
    const row = (
      await pool.query(
        "SELECT a.tenant_id,a.resource_id,t.plan,t.name salon_name FROM action_tokens a JOIN tenants t ON t.id=a.tenant_id WHERE a.token_hash=$1 AND a.purpose='intake_form' AND a.expires_at>now() AND t.status='active'",
        [digest(z.string().min(30).max(100).parse(token))],
      )
    ).rows[0];
    if (!row)
      throw new HttpError(
        410,
        "This form link is invalid or has expired. Ask the salon for a new link.",
      );
    await feature(row.tenant_id, "forms", row.plan);
    return row;
  }
  app.get(
    "/api/v1/intake/:token",
    intakeLimit,
    wrap(async (req, res) => {
      const token = await discover(String(req.params.token));
      ok(
        res,
        await scoped(token.tenant_id, async (c) => {
          const link = (
            await c.query(
              `SELECT l.*,f.active,cu.name customer_name FROM intake_links l JOIN forms f ON f.id=l.form_id AND f.tenant_id=l.tenant_id LEFT JOIN customers cu ON cu.id=l.customer_id AND cu.tenant_id=l.tenant_id WHERE l.tenant_id=$1 AND l.id=$2 AND (l.customer_id IS NULL OR cu.deleted_at IS NULL)`,
              [token.tenant_id, token.resource_id],
            )
          ).rows[0];
          if (
            !link ||
            !link.active ||
            link.revoked_at ||
            new Date(link.expires_at).getTime() <= Date.now() ||
            link.uses >= link.max_uses
          )
            throw new HttpError(
              410,
              "This link is closed, expired or has reached its submission limit.",
            );
          return {
            name: link.name_snapshot,
            description: link.description_snapshot,
            fields: link.fields_snapshot,
            salon_name: token.salon_name,
            customer_name: link.customer_name,
            identify: !link.customer_id,
            expires_at: link.expires_at,
            remaining: link.max_uses - link.uses,
          };
        }),
      );
    }),
  );
  app.post(
    "/api/v1/intake/:token",
    intakeLimit,
    wrap(async (req, res) => {
      const token = await discover(String(req.params.token));
      const d = z
        .object({
          answers: z.record(
            z.string(),
            z.union([z.string().max(5000), z.boolean()]),
          ),
          respondent_name: z.string().max(120).transform(plainText).optional(),
          respondent_email: z.string().trim().email().max(254).optional(),
          device: z
            .object({
              language: z.string().max(40).optional(),
              timezone: z.string().max(80).optional(),
              screen: z.string().max(40).optional(),
            })
            .strict()
            .default({}),
        })
        .strict()
        .parse(req.body);
      await scoped(token.tenant_id, async (c) => {
        const link = (
          await c.query(
            "SELECT * FROM intake_links WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
            [token.tenant_id, token.resource_id],
          )
        ).rows[0];
        if (
          !link ||
          link.revoked_at ||
          new Date(link.expires_at).getTime() <= Date.now() ||
          link.uses >= link.max_uses
        )
          throw new HttpError(
            410,
            "This link is closed, expired or has reached its submission limit.",
          );
        if (
          !(
            await c.query(
              "SELECT 1 FROM forms WHERE tenant_id=$1 AND id=$2 AND active FOR SHARE",
              [token.tenant_id, link.form_id],
            )
          ).rowCount
        )
          throw new HttpError(
            410,
            "This form is no longer accepting responses.",
          );
        const customer = link.customer_id
          ? (
              await c.query(
                "SELECT name,email FROM customers WHERE tenant_id=$1 AND id=$2 AND deleted_at IS NULL",
                [token.tenant_id, link.customer_id],
              )
            ).rows[0]
          : null;
        if (link.customer_id && !customer)
          throw new HttpError(410, "This link is no longer available.");
        if (!customer && (!d.respondent_name || !d.respondent_email))
          throw new HttpError(422, "Enter your name and email.");
        let answers;
        try {
          answers = validateAnswers(link.fields_snapshot, d.answers);
        } catch (error) {
          throw new HttpError(422, (error as Error).message);
        }
        await c.query(
          "INSERT INTO form_submissions(tenant_id,form_id,customer_id,answers,link_id,fields_snapshot,respondent_name,respondent_email,device) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          [
            token.tenant_id,
            link.form_id,
            link.customer_id,
            JSON.stringify(answers),
            link.id,
            JSON.stringify(link.fields_snapshot),
            customer?.name || d.respondent_name,
            customer?.email || d.respondent_email,
            JSON.stringify(
              deviceSummary(req.get("User-Agent") || "", d.device),
            ),
          ],
        );
        await c.query(
          "UPDATE intake_links SET uses=uses+1 WHERE tenant_id=$1 AND id=$2",
          [token.tenant_id, link.id],
        );
      });
      ok(res, { submitted: true });
    }),
  );
}
