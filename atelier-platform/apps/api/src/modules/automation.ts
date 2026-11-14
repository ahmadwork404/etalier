import type express from "express";
import { z } from "zod";
import { scoped, audit } from "../db.js";
import { wrap, ok, tenantContext, feature } from "../runtime.js";
import { HttpError } from "../security.js";
export function register(app: express.Express) {
  app.patch(
    "/api/v1/workflows/:id",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "marketing.write");
      await feature(s.tenant_id, "automations", s.plan);
      const id = z.string().uuid().parse(req.params.id),
        d = z.object({ enabled: z.boolean() }).parse(req.body);
      await scoped(s.tenant_id, async (c) => {
        if (
          !(
            await c.query(
              "UPDATE workflows SET enabled=$3 WHERE tenant_id=$1 AND id=$2",
              [s.tenant_id, id, d.enabled],
            )
          ).rowCount
        )
          throw new HttpError(404, "Workflow not found");
        await audit(c, s.user_id, s.tenant_id, "workflow.toggled", id);
      });
      ok(res, { updated: true });
    }),
  );
  app.post(
    "/api/v1/campaigns/:id/queue",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "marketing.write");
      await feature(s.tenant_id, "marketing", s.plan);
      const id = z.string().uuid().parse(req.params.id);
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const campaign = (
            await c.query(
              "SELECT * FROM campaigns WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
              [s.tenant_id, id],
            )
          ).rows[0];
          if (!campaign) throw new HttpError(404, "Campaign not found");
          if (campaign.status !== "draft")
            throw new HttpError(409, "Campaign already queued or closed");
          await feature(s.tenant_id, campaign.channel, s.plan);
          const customers = (
            await c.query(
              "SELECT id FROM customers WHERE tenant_id=$1 AND marketing_consent AND deleted_at IS NULL AND preferred_channel=$2 LIMIT 5000",
              [s.tenant_id, campaign.channel],
            )
          ).rows;
          for (const customer of customers) {
            const job = (
              await c.query(
                "INSERT INTO jobs(tenant_id,feature_key,type,payload,deduplication_key) VALUES($1,'marketing','notification',$2,$3) ON CONFLICT DO NOTHING RETURNING id",
                [
                  s.tenant_id,
                  JSON.stringify({
                    customer_id: customer.id,
                    campaign_id: id,
                    channel: campaign.channel,
                    subject: campaign.subject,
                    body: campaign.body,
                  }),
                  "campaign:" + id + ":" + customer.id,
                ],
              )
            ).rows[0];
            if (job)
              await c.query(
                "INSERT INTO notifications(tenant_id,customer_id,channel,subject,body,job_id) VALUES($1,$2,$3,$4,$5,$6)",
                [
                  s.tenant_id,
                  customer.id,
                  campaign.channel,
                  campaign.subject,
                  campaign.body,
                  job.id,
                ],
              );
          }
          await c.query(
            "UPDATE campaigns SET status='queued' WHERE tenant_id=$1 AND id=$2",
            [s.tenant_id, id],
          );
          await audit(c, s.user_id, s.tenant_id, "campaign.queued", id);
          return { queued: customers.length };
        }),
      );
    }),
  );
  app.patch(
    "/api/v1/campaigns/:id",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "marketing.write");
      await feature(s.tenant_id, "marketing", s.plan);
      const id = z.string().uuid().parse(req.params.id),
        d = z.object({ status: z.enum(["paused", "queued"]) }).parse(req.body);
      await scoped(s.tenant_id, async (c) => {
        if (
          !(
            await c.query(
              "UPDATE campaigns SET status=$3 WHERE tenant_id=$1 AND id=$2 AND status IN ('paused','queued')",
              [s.tenant_id, id, d.status],
            )
          ).rowCount
        )
          throw new HttpError(409, "Campaign must have been queued first");
        await audit(c, s.user_id, s.tenant_id, "campaign." + d.status, id);
      });
      ok(res, { updated: true });
    }),
  );
}
