import type express from "express";
import { z } from "zod";
import { scoped, audit } from "../db.js";
import { wrap, ok, tenantContext, feature } from "../runtime.js";
import { HttpError, newToken, digest } from "../security.js";
import { sameBranch } from "../services/inventory.js";
const uuid = z.string().uuid(),
  minor = z.number().int().positive().max(1000000000);
export function register(app: express.Express) {
  app.get(
    "/api/v1/loyalty",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "marketing.read");
      await feature(s.tenant_id, "loyalty", s.plan);
      ok(
        res,
        await scoped(
          s.tenant_id,
          async (c) =>
            (
              await c.query(
                "SELECT a.*,cu.name customer_name FROM loyalty_accounts a JOIN customers cu ON cu.id=a.customer_id AND cu.tenant_id=a.tenant_id WHERE a.tenant_id=$1 ORDER BY cu.name LIMIT 100",
                [s.tenant_id],
              )
            ).rows,
        ),
      );
    }),
  );
  app.post(
    "/api/v1/loyalty",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "marketing.write");
      await feature(s.tenant_id, "loyalty", s.plan);
      const d = z
        .object({
          customer_id: uuid,
          points: z
            .number()
            .int()
            .min(-100000)
            .max(100000)
            .refine((v) => v !== 0),
          reason: z.string().min(3).max(300),
          idempotency_key: z.string().min(8).max(100),
        })
        .parse(req.body);
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          await c.query(
            "INSERT INTO loyalty_accounts(tenant_id,customer_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
            [s.tenant_id, d.customer_id],
          );
          await c.query(
            "SELECT 1 FROM loyalty_accounts WHERE tenant_id=$1 AND customer_id=$2 FOR UPDATE",
            [s.tenant_id, d.customer_id],
          );
          const prior = (
            await c.query(
              "SELECT * FROM loyalty_transactions WHERE tenant_id=$1 AND idempotency_key=$2",
              [s.tenant_id, d.idempotency_key],
            )
          ).rows[0];
          if (prior) return prior;
          if (
            !(
              await c.query(
                "UPDATE loyalty_accounts SET points=points+$3 WHERE tenant_id=$1 AND customer_id=$2 AND points+$3>=0",
                [s.tenant_id, d.customer_id, d.points],
              )
            ).rowCount
          )
            throw new HttpError(409, "Insufficient loyalty points");
          const row = (
            await c.query(
              "INSERT INTO loyalty_transactions(tenant_id,customer_id,points,reason,idempotency_key) VALUES($1,$2,$3,$4,$5) RETURNING *",
              [
                s.tenant_id,
                d.customer_id,
                d.points,
                d.reason,
                d.idempotency_key,
              ],
            )
          ).rows[0];
          await audit(c, s.user_id, s.tenant_id, "loyalty.adjusted", row.id);
          return row;
        }),
        201,
      );
    }),
  );
  app.get(
    "/api/v1/membership-plans",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "marketing.read");
      await feature(s.tenant_id, "memberships", s.plan);
      ok(
        res,
        await scoped(
          s.tenant_id,
          async (c) =>
            (
              await c.query(
                "SELECT * FROM membership_plans WHERE tenant_id=$1 ORDER BY name",
                [s.tenant_id],
              )
            ).rows,
        ),
      );
    }),
  );
  app.post(
    "/api/v1/membership-plans",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "marketing.write");
      await feature(s.tenant_id, "memberships", s.plan);
      const d = z
        .object({
          name: z.string().min(2).max(100),
          price_minor: z.number().int().min(0).max(1000000000),
          duration_days: z.number().int().min(1).max(3660),
          service_credits: z.number().int().min(0).max(10000),
        })
        .parse(req.body);
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const row = (
            await c.query(
              "INSERT INTO membership_plans(tenant_id,name,price_minor,duration_days,service_credits) VALUES($1,$2,$3,$4,$5) RETURNING *",
              [
                s.tenant_id,
                d.name,
                d.price_minor,
                d.duration_days,
                d.service_credits,
              ],
            )
          ).rows[0];
          await audit(
            c,
            s.user_id,
            s.tenant_id,
            "membership_plan.created",
            row.id,
          );
          return row;
        }),
        201,
      );
    }),
  );
  app.get(
    "/api/v1/memberships",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "marketing.read");
      await feature(s.tenant_id, "memberships", s.plan);
      ok(
        res,
        await scoped(
          s.tenant_id,
          async (c) =>
            (
              await c.query(
                "SELECT m.*,p.name,cu.name customer_name FROM customer_memberships m JOIN membership_plans p ON p.id=m.plan_id AND p.tenant_id=m.tenant_id JOIN customers cu ON cu.id=m.customer_id AND cu.tenant_id=m.tenant_id WHERE m.tenant_id=$1 ORDER BY m.starts_at DESC LIMIT 100",
                [s.tenant_id],
              )
            ).rows,
        ),
      );
    }),
  );
  app.post(
    "/api/v1/memberships",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "marketing.write");
      await feature(s.tenant_id, "memberships", s.plan);
      const d = z.object({ customer_id: uuid, plan_id: uuid }).parse(req.body);
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const plan = (
            await c.query(
              "SELECT * FROM membership_plans WHERE tenant_id=$1 AND id=$2",
              [s.tenant_id, d.plan_id],
            )
          ).rows[0];
          if (!plan) throw new HttpError(404, "Plan not found");
          const row = (
            await c.query(
              "INSERT INTO customer_memberships(tenant_id,customer_id,plan_id,expires_at,credits_remaining) VALUES($1,$2,$3,now()+$4*interval '1 day',$5) RETURNING *",
              [
                s.tenant_id,
                d.customer_id,
                d.plan_id,
                plan.duration_days,
                plan.service_credits,
              ],
            )
          ).rows[0];
          await audit(c, s.user_id, s.tenant_id, "membership.issued", row.id);
          return row;
        }),
        201,
      );
    }),
  );
  app.post(
    "/api/v1/memberships/:id/redeem",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "marketing.write");
      await feature(s.tenant_id, "memberships", s.plan);
      const id = uuid.parse(req.params.id),
        d = z.object({ appointment_id: uuid }).parse(req.body);
      await scoped(s.tenant_id, async (c) => {
        const m = (
          await c.query(
            "SELECT * FROM customer_memberships WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
            [s.tenant_id, id],
          )
        ).rows[0];
        if (
          !m ||
          m.status !== "active" ||
          new Date(m.expires_at) <= new Date() ||
          m.credits_remaining < 1
        )
          throw new HttpError(409, "No valid membership credit available");
        const a = (
          await c.query(
            "SELECT * FROM appointments WHERE tenant_id=$1 AND id=$2",
            [s.tenant_id, d.appointment_id],
          )
        ).rows[0];
        if (!a || a.customer_id !== m.customer_id)
          throw new HttpError(
            422,
            "Appointment does not belong to this customer",
          );
        sameBranch(s, a.branch_id);
        await c.query(
          "INSERT INTO membership_redemptions(tenant_id,membership_id,appointment_id) VALUES($1,$2,$3)",
          [s.tenant_id, id, a.id],
        );
        await c.query(
          "UPDATE customer_memberships SET credits_remaining=credits_remaining-1 WHERE tenant_id=$1 AND id=$2",
          [s.tenant_id, id],
        );
        await audit(c, s.user_id, s.tenant_id, "membership.redeemed", id);
      });
      ok(res, { redeemed: true });
    }),
  );
  app.patch(
    "/api/v1/memberships/:id",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "marketing.write");
      await feature(s.tenant_id, "memberships", s.plan);
      const id = uuid.parse(req.params.id);
      await scoped(s.tenant_id, async (c) => {
        if (
          !(
            await c.query(
              "UPDATE customer_memberships SET status='cancelled' WHERE tenant_id=$1 AND id=$2",
              [s.tenant_id, id],
            )
          ).rowCount
        )
          throw new HttpError(404, "Membership not found");
        await audit(c, s.user_id, s.tenant_id, "membership.cancelled", id);
      });
      ok(res, { cancelled: true });
    }),
  );
  app.get(
    "/api/v1/gift-cards",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "finance.read");
      await feature(s.tenant_id, "gift_cards", s.plan);
      ok(
        res,
        await scoped(
          s.tenant_id,
          async (c) =>
            (
              await c.query(
                "SELECT id,last_four,initial_minor,balance_minor,expires_on FROM gift_cards WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 100",
                [s.tenant_id],
              )
            ).rows,
        ),
      );
    }),
  );
  app.post(
    "/api/v1/gift-cards",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "finance.write");
      await feature(s.tenant_id, "gift_cards", s.plan);
      const d = z
          .object({
            initial_minor: minor,
            expires_on: z
              .string()
              .date()
              .refine((v) => new Date(v) > new Date()),
          })
          .parse(req.body),
        code = newToken();
      const row = await scoped(s.tenant_id, async (c) => {
        const r = (
          await c.query(
            "INSERT INTO gift_cards(tenant_id,code_hash,last_four,initial_minor,balance_minor,expires_on) VALUES($1,$2,$3,$4,$4,$5) RETURNING id,last_four,balance_minor,expires_on",
            [
              s.tenant_id,
              digest(code),
              code.slice(-4),
              d.initial_minor,
              d.expires_on,
            ],
          )
        ).rows[0];
        await audit(c, s.user_id, s.tenant_id, "gift_card.created", r.id);
        return r;
      });
      ok(res, { ...row, code }, 201);
    }),
  );
  app.post(
    "/api/v1/gift-cards/redeem",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "finance.write");
      await feature(s.tenant_id, "gift_cards", s.plan);
      const d = z
        .object({
          code: z.string().min(30).max(100),
          order_id: uuid,
          amount_minor: minor,
          idempotency_key: z.string().min(8).max(100),
        })
        .parse(req.body);
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const order = (
            await c.query(
              "SELECT * FROM orders WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
              [s.tenant_id, d.order_id],
            )
          ).rows[0];
          if (!order) throw new HttpError(404, "Order not found");
          sameBranch(s, order.branch_id);
          const prior = (
            await c.query(
              "SELECT * FROM gift_card_redemptions WHERE tenant_id=$1 AND idempotency_key=$2",
              [s.tenant_id, d.idempotency_key],
            )
          ).rows[0];
          if (prior) return prior;
          const card = (
            await c.query(
              "SELECT * FROM gift_cards WHERE tenant_id=$1 AND code_hash=$2 AND expires_on>=CURRENT_DATE FOR UPDATE",
              [s.tenant_id, digest(d.code)],
            )
          ).rows[0];
          if (!card || Number(card.balance_minor) < d.amount_minor)
            throw new HttpError(
              409,
              "Card invalid, expired or insufficient balance",
            );
          const paid = Number(
            (
              await c.query(
                "SELECT COALESCE(sum(amount_minor),0) total FROM payments WHERE tenant_id=$1 AND order_id=$2",
                [s.tenant_id, order.id],
              )
            ).rows[0].total,
          );
          if (
            order.status !== "open" ||
            paid + d.amount_minor > Number(order.total_minor)
          )
            throw new HttpError(409, "Amount exceeds outstanding balance");
          await c.query(
            "UPDATE gift_cards SET balance_minor=balance_minor-$3 WHERE tenant_id=$1 AND id=$2",
            [s.tenant_id, card.id, d.amount_minor],
          );
          const r = (
            await c.query(
              "INSERT INTO gift_card_redemptions(tenant_id,gift_card_id,order_id,amount_minor,idempotency_key) VALUES($1,$2,$3,$4,$5) RETURNING *",
              [
                s.tenant_id,
                card.id,
                order.id,
                d.amount_minor,
                d.idempotency_key,
              ],
            )
          ).rows[0];
          await c.query(
            "INSERT INTO payments(tenant_id,order_id,amount_minor,method,idempotency_key) VALUES($1,$2,$3,'gift_card',$4)",
            [s.tenant_id, order.id, d.amount_minor, d.idempotency_key],
          );
          if (paid + d.amount_minor === Number(order.total_minor))
            await c.query(
              "UPDATE orders SET status='paid' WHERE tenant_id=$1 AND id=$2",
              [s.tenant_id, order.id],
            );
          await audit(c, s.user_id, s.tenant_id, "gift_card.redeemed", r.id);
          return r;
        }),
        201,
      );
    }),
  );
}
