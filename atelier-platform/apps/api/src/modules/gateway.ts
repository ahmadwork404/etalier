import { portalUrl } from "../services/public-urls.js";
import Stripe from "stripe";
import type express from "express";
import { z } from "zod";
import { pool, scoped, audit } from "../db.js";
import { wrap, ok, tenantContext, feature } from "../runtime.js";
import { HttpError } from "../security.js";
import { sameBranch } from "../services/inventory.js";
function stripe() {
  if (!process.env.STRIPE_SECRET_KEY)
    throw new HttpError(503, "Stripe is not configured");
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}
export function register(app: express.Express) {
  app.post(
    "/api/v1/orders/:id/checkout",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "finance.write");
      await feature(s.tenant_id, "payments", s.plan);
      const id = z.string().uuid().parse(req.params.id);
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const o = (
            await c.query(
              "SELECT * FROM orders WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
              [s.tenant_id, id],
            )
          ).rows[0];
          if (!o || o.status !== "open")
            throw new HttpError(409, "Order unavailable");
          sameBranch(s, o.branch_id);
          if (
            !(
              await c.query("SELECT payment_methods FROM tenants WHERE id=$1", [
                s.tenant_id,
              ])
            ).rows[0].payment_methods.includes("stripe")
          )
            throw new HttpError(
              422,
              "Online Stripe payments are disabled for this salon.",
            );
          const prior = (
            await c.query(
              "SELECT * FROM gateway_checkouts WHERE tenant_id=$1 AND order_id=$2 AND status='pending' AND expires_at>now()",
              [s.tenant_id, id],
            )
          ).rows[0];
          if (prior)
            return {
              url: (await stripe().checkout.sessions.retrieve(prior.id)).url,
            };
          const paid = Number(
              (
                await c.query(
                  "SELECT COALESCE(sum(amount_minor),0) total FROM payments WHERE tenant_id=$1 AND order_id=$2",
                  [s.tenant_id, id],
                )
              ).rows[0].total,
            ),
            amount = Number(o.total_minor) - paid;
          if (amount <= 0) throw new HttpError(409, "No outstanding balance");
          const currency = (
            await c.query("SELECT currency FROM tenants WHERE id=$1", [
              s.tenant_id,
            ])
          ).rows[0].currency;
          const origin = portalUrl();
          const checkout = await stripe().checkout.sessions.create(
            {
              mode: "payment",
              success_url: origin + "/?checkout=success",
              cancel_url: origin + "/?checkout=cancelled",
              line_items: [
                {
                  price_data: {
                    currency: currency.toLowerCase(),
                    product_data: { name: "Atelier order " + id.slice(0, 8) },
                    unit_amount: amount,
                  },
                  quantity: 1,
                },
              ],
              metadata: { tenant_id: s.tenant_id, order_id: id },
            },
            { idempotencyKey: "checkout:" + id + ":" + paid },
          );
          await c.query(
            "INSERT INTO gateway_checkouts(id,tenant_id,order_id,amount_minor,expires_at) VALUES($1,$2,$3,$4,to_timestamp($5))",
            [checkout.id, s.tenant_id, id, amount, checkout.expires_at],
          );
          await audit(c, s.user_id, s.tenant_id, "stripe.checkout_created", id);
          return { url: checkout.url };
        }),
      );
    }),
  );
  app.post(
    "/api/v1/webhooks/stripe",
    wrap(async (req, res) => {
      if (!process.env.STRIPE_WEBHOOK_SECRET)
        throw new HttpError(503, "Stripe webhook is not configured");
      let event: Stripe.Event;
      try {
        event = stripe().webhooks.constructEvent(
          (req as any).rawBody,
          req.headers["stripe-signature"] as string,
          process.env.STRIPE_WEBHOOK_SECRET,
        );
      } catch {
        throw new HttpError(400, "Invalid webhook signature");
      }
      if (
        event.type === "checkout.session.completed" ||
        event.type === "checkout.session.expired"
      ) {
        const checkout = event.data.object as Stripe.Checkout.Session;
        const link = (
          await pool.query("SELECT * FROM gateway_checkouts WHERE id=$1", [
            checkout.id,
          ])
        ).rows[0];
        if (link)
          await scoped(link.tenant_id, async (c) => {
            const o = (
              await c.query(
                "SELECT * FROM orders WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
                [link.tenant_id, link.order_id],
              )
            ).rows[0];
            if (
              (
                await c.query("SELECT 1 FROM gateway_events WHERE id=$1", [
                  event.id,
                ])
              ).rowCount
            )
              return;
            if (
              event.type === "checkout.session.completed" &&
              checkout.payment_status === "paid"
            ) {
              if (
                checkout.amount_total !== Number(link.amount_minor) ||
                checkout.metadata?.tenant_id !== link.tenant_id ||
                checkout.metadata?.order_id !== o.id
              )
                throw new HttpError(409, "Checkout attribution mismatch");
              await c.query(
                "INSERT INTO payments(tenant_id,order_id,amount_minor,method,idempotency_key,provider_reference) VALUES($1,$2,$3,'stripe',$4,$5) ON CONFLICT DO NOTHING",
                [
                  link.tenant_id,
                  o.id,
                  link.amount_minor,
                  "stripe:" + checkout.id,
                  checkout.id,
                ],
              );
              await c.query(
                "UPDATE orders SET status='paid' WHERE tenant_id=$1 AND id=$2",
                [link.tenant_id, o.id],
              );
              await c.query(
                "UPDATE gateway_checkouts SET status='completed' WHERE id=$1",
                [checkout.id],
              );
              await c.query(
                "INSERT INTO audit_logs(tenant_id,action,target_id) VALUES($1,'stripe.payment_confirmed',$2)",
                [link.tenant_id, o.id],
              );
            } else if (event.type === "checkout.session.expired")
              await c.query(
                "UPDATE gateway_checkouts SET status='expired' WHERE id=$1",
                [checkout.id],
              );
            await c.query(
              "INSERT INTO gateway_events(id) VALUES($1) ON CONFLICT DO NOTHING",
              [event.id],
            );
          });
      }
      ok(res, { received: true });
    }),
  );
}
