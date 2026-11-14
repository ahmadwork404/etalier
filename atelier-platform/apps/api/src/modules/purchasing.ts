import type express from "express";
import { z } from "zod";
import { scoped, audit } from "../db.js";
import { wrap, ok, tenantContext, feature } from "../runtime.js";
import { HttpError } from "../security.js";
import { moveStock, sameBranch } from "../services/inventory.js";
export function register(app: express.Express) {
  app.get(
    "/api/v1/purchase-orders",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "inventory.read");
      await feature(s.tenant_id, "inventory", s.plan);
      ok(
        res,
        await scoped(
          s.tenant_id,
          async (c) =>
            (
              await c.query(
                "SELECT p.*,su.name supplier_name,b.name branch_name FROM purchase_orders p JOIN suppliers su ON su.id=p.supplier_id AND su.tenant_id=p.tenant_id JOIN branches b ON b.id=p.branch_id AND b.tenant_id=p.tenant_id WHERE p.tenant_id=$1 AND ($2::uuid IS NULL OR p.branch_id=$2) ORDER BY p.created_at DESC LIMIT 100",
                [s.tenant_id, s.branch_id],
              )
            ).rows,
        ),
      );
    }),
  );
  app.post(
    "/api/v1/purchase-orders",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "inventory.write");
      await feature(s.tenant_id, "inventory", s.plan);
      const d = z
        .object({
          supplier_id: z.string().uuid(),
          branch_id: z.string().uuid(),
          items: z
            .array(
              z.object({
                product_id: z.string().uuid(),
                quantity: z.number().positive().max(100000),
                cost_minor: z.number().int().min(0).max(100000000),
              }),
            )
            .min(1)
            .max(50),
        })
        .parse(req.body);
      sameBranch(s, d.branch_id);
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const p = (
            await c.query(
              "INSERT INTO purchase_orders(tenant_id,supplier_id,branch_id) VALUES($1,$2,$3) RETURNING *",
              [s.tenant_id, d.supplier_id, d.branch_id],
            )
          ).rows[0];
          for (const i of d.items)
            await c.query(
              "INSERT INTO purchase_order_items(tenant_id,purchase_order_id,product_id,quantity,cost_minor) VALUES($1,$2,$3,$4,$5)",
              [s.tenant_id, p.id, i.product_id, i.quantity, i.cost_minor],
            );
          await audit(
            c,
            s.user_id,
            s.tenant_id,
            "purchase_order.created",
            p.id,
          );
          return p;
        }),
        201,
      );
    }),
  );
  app.post(
    "/api/v1/purchase-orders/:id/receive",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "inventory.write");
      await feature(s.tenant_id, "inventory", s.plan);
      const id = z.string().uuid().parse(req.params.id);
      await scoped(s.tenant_id, async (c) => {
        const p = (
          await c.query(
            "SELECT * FROM purchase_orders WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
            [s.tenant_id, id],
          )
        ).rows[0];
        if (!p) throw new HttpError(404, "Purchase order not found");
        sameBranch(s, p.branch_id);
        if (p.status === "received") return;
        if (p.status !== "draft")
          throw new HttpError(409, "Purchase order is closed");
        const items = (
          await c.query(
            "SELECT * FROM purchase_order_items WHERE tenant_id=$1 AND purchase_order_id=$2 ORDER BY product_id",
            [s.tenant_id, id],
          )
        ).rows;
        for (const i of items)
          await moveStock(
            c,
            s.tenant_id,
            p.branch_id,
            i.product_id,
            Number(i.quantity),
            "goods_received",
            s.user_id,
            id,
          );
        await c.query(
          "UPDATE purchase_orders SET status='received' WHERE tenant_id=$1 AND id=$2",
          [s.tenant_id, id],
        );
        await audit(c, s.user_id, s.tenant_id, "purchase_order.received", id);
      });
      ok(res, { received: true });
    }),
  );
}
