import type express from "express";
import { z } from "zod";
import { scoped, audit } from "../db.js";
import { wrap, ok, tenantContext, feature, authLimit } from "../runtime.js";
import { HttpError } from "../security.js";
import { customerToken } from "./engagement.js";
import { sameBranch } from "../services/inventory.js";
import { storage } from "../services/storage.js";
import { DeleteObjectCommand } from "../services/r2-client.js";
export function register(app: express.Express) {
  app.post(
    "/api/v1/customer-link/:token/privacy",
    authLimit,
    wrap(async (req, res) => {
      const t = await customerToken(
          z.string().min(30).max(100).parse(req.params.token),
          ["portal"],
        ),
        d = z
          .object({ type: z.enum(["export", "deletion", "ugc_withdrawal"]) })
          .parse(req.body);
      ok(
        res,
        await scoped(t.tenant_id, async (c) => {
          const row = (
            await c.query(
              "INSERT INTO privacy_requests(tenant_id,customer_id,type) VALUES($1,$2,$3) RETURNING id,status",
              [t.tenant_id, t.customer_id, d.type],
            )
          ).rows[0];
          if (d.type === "ugc_withdrawal") {
            await c.query(
              "UPDATE ugc_submissions SET status='withdrawn',consent_granted=false WHERE tenant_id=$1 AND customer_id=$2",
              [t.tenant_id, t.customer_id],
            );
            await c.query(
              "INSERT INTO consent_records(tenant_id,customer_id,purpose,granted) VALUES($1,$2,'ugc_marketing',false)",
              [t.tenant_id, t.customer_id],
            );
            await c.query(
              "UPDATE privacy_requests SET status='completed',completed_at=now() WHERE tenant_id=$1 AND id=$2",
              [t.tenant_id, row.id],
            );
            row.status = "completed";
          }
          return row;
        }),
        201,
      );
    }),
  );
  app.get(
    "/api/v1/privacy-requests",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "settings.manage");
      ok(
        res,
        await scoped(
          s.tenant_id,
          async (c) =>
            (
              await c.query(
                "SELECT p.*,cu.name customer_name FROM privacy_requests p JOIN customers cu ON cu.id=p.customer_id AND cu.tenant_id=p.tenant_id WHERE p.tenant_id=$1 ORDER BY p.created_at DESC LIMIT 100",
                [s.tenant_id],
              )
            ).rows,
        ),
      );
    }),
  );
  app.get(
    "/api/v1/customers/:id/export",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "settings.manage");
      const id = z.string().uuid().parse(req.params.id);
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const customer = (
            await c.query(
              "SELECT * FROM customers WHERE tenant_id=$1 AND id=$2",
              [s.tenant_id, id],
            )
          ).rows[0];
          if (!customer) throw new HttpError(404, "Customer not found");
          const output: any = { customer };
          for (const table of [
            "appointments",
            "consent_records",
            "reviews",
            "form_submissions",
            "quick_work_visits",
            "ugc_submissions",
            "customer_memberships",
            "loyalty_transactions",
          ])
            output[table] = (
              await c.query(
                `SELECT * FROM ${table} WHERE tenant_id=$1 AND customer_id=$2`,
                [s.tenant_id, id],
              )
            ).rows;
          await audit(c, s.user_id, s.tenant_id, "customer.exported", id);
          return output;
        }),
      );
    }),
  );
  app.post(
    "/api/v1/privacy-requests/:id/complete",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "settings.manage");
      if (!s.is_owner)
        throw new HttpError(
          403,
          "Only business owners can complete privacy requests",
        );
      const id = z.string().uuid().parse(req.params.id);
      await scoped(s.tenant_id, async (c) => {
        const request = (
          await c.query(
            "SELECT * FROM privacy_requests WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
            [s.tenant_id, id],
          )
        ).rows[0];
        if (!request) throw new HttpError(404, "Request not found");
        if (request.status === "completed") return;
        if (request.type === "deletion") {
          const media = (
            await c.query(
              "SELECT object_key FROM media WHERE tenant_id=$1 AND customer_id=$2",
              [s.tenant_id, request.customer_id],
            )
          ).rows;
          if (media.length) {
            const client = storage();
            for (const m of media)
              await client.send(
                new DeleteObjectCommand({
                  Bucket: process.env.R2_BUCKET,
                  Key: m.object_key,
                }),
              );
          }
          await c.query(
            "DELETE FROM action_tokens WHERE tenant_id=$1 AND customer_id=$2",
            [s.tenant_id, request.customer_id],
          );
          await c.query(
            "UPDATE ugc_submissions SET status='withdrawn',consent_granted=false,testimonial='' WHERE tenant_id=$1 AND customer_id=$2",
            [s.tenant_id, request.customer_id],
          );
          await c.query(
            "UPDATE form_submissions SET answers='{}'::jsonb,respondent_name=NULL,respondent_email=NULL,device='{}'::jsonb WHERE tenant_id=$1 AND customer_id=$2",
            [s.tenant_id, request.customer_id],
          );
          await c.query(
            "UPDATE intake_links SET revoked_at=COALESCE(revoked_at,now()) WHERE tenant_id=$1 AND customer_id=$2",
            [s.tenant_id, request.customer_id],
          );
          await c.query(
            "UPDATE reviews SET body='',response=NULL WHERE tenant_id=$1 AND customer_id=$2",
            [s.tenant_id, request.customer_id],
          );
          await c.query(
            "UPDATE customers SET name='Deleted customer',email=NULL,phone=NULL,notes='',tags='{}',birthday=NULL,marketing_consent=false,preferred_channel='none',deleted_at=now() WHERE tenant_id=$1 AND id=$2",
            [s.tenant_id, request.customer_id],
          );
          await c.query(
            "UPDATE notifications SET body='',subject='' WHERE tenant_id=$1 AND customer_id=$2",
            [s.tenant_id, request.customer_id],
          );
          await c.query(
            "UPDATE appointments SET notes='' WHERE tenant_id=$1 AND customer_id=$2",
            [s.tenant_id, request.customer_id],
          );
          await c.query(
            "UPDATE media SET verified=false WHERE tenant_id=$1 AND customer_id=$2",
            [s.tenant_id, request.customer_id],
          );
        }
        await c.query(
          "UPDATE privacy_requests SET status='completed',completed_at=now() WHERE tenant_id=$1 AND id=$2",
          [s.tenant_id, id],
        );
        await audit(c, s.user_id, s.tenant_id, "privacy_request.completed", id);
      });
      ok(res, { completed: true });
    }),
  );
}
