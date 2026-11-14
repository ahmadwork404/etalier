import type express from "express";
import { z } from "zod";
import { scoped, audit } from "../db.js";
import { wrap, ok, tenantContext, feature } from "../runtime.js";
import { HttpError } from "../security.js";
import { moveStock, sameBranch } from "../services/inventory.js";
const uuid = z.string().uuid(),
  minor = z.number().int().min(0).max(1000000000);
const schemas = {
  suppliers: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().email().optional(),
    phone: z.string().max(40).optional(),
  }),
  products: z.object({
    name: z.string().min(2).max(120),
    sku: z.string().min(1).max(80),
    supplier_id: uuid.optional(),
    cost_minor: minor.default(0),
    price_minor: minor,
    minimum_stock: z.number().min(0).max(100000).default(5),
    expires_on: z.string().date().optional(),
  }),
  expenses: z.object({
    name: z.string().min(2).max(200),
    branch_id: uuid,
    amount_minor: minor.refine((v) => v > 0),
    incurred_on: z.string().date(),
  }),
};
export function register(app: express.Express) {
  for (const [name, schema] of Object.entries(schemas)) {
    app.get(
      "/api/v1/" + name,
      wrap(async (req, res) => {
        const s = await tenantContext(
          req,
          name === "expenses" ? "finance.read" : "inventory.read",
        );
        await feature(
          s.tenant_id,
          name === "expenses" ? "sales_management" : "inventory",
          s.plan,
        );
        const filters = z
          .object({
            page: z.coerce.number().int().min(1).default(1),
            q: z.string().max(100).default(""),
            status: z.enum(["all", "active", "inactive"]).default("all"),
            sort: z.enum(["name_asc", "name_desc"]).default("name_asc"),
          })
          .parse(req.query);
        ok(
          res,
          await scoped(s.tenant_id, async (client) => {
            const parameters = [
              s.tenant_id,
              "%" + filters.q + "%",
              s.branch_id,
              filters.status,
            ];
            const searchable =
              name === "products"
                ? "name ILIKE $2 OR sku ILIKE $2"
                : name === "suppliers"
                  ? "name ILIKE $2 OR COALESCE(email,'') ILIKE $2 OR COALESCE(phone,'') ILIKE $2"
                  : "name ILIKE $2";
            const where =
              "tenant_id=$1 AND (" +
              searchable +
              ") AND ($3::uuid IS NULL" +
              (name === "expenses"
                ? " OR branch_id=$3)"
                : " OR $3::uuid IS NOT NULL)") +
              " AND " +
              (name === "products"
                ? "($4='all' OR active=($4='active'))"
                : "($4::text IS NOT NULL)");
            const total = Number(
              (
                await client.query(
                  `SELECT count(*) FROM ${name} WHERE ${where}`,
                  parameters,
                )
              ).rows[0].count,
            );
            const items = (
              await client.query(
                `SELECT * FROM ${name} WHERE ${where} ORDER BY name ${filters.sort === "name_desc" ? "DESC" : "ASC"},id LIMIT 25 OFFSET $5`,
                [...parameters, (filters.page - 1) * 25],
              )
            ).rows;
            return {
              items,
              total,
              page: filters.page,
              pageSize: 25,
              hasMore: filters.page * 25 < total,
            };
          }),
        );
      }),
    );
    app.post(
      "/api/v1/" + name,
      wrap(async (req, res) => {
        const s = await tenantContext(
          req,
          name === "expenses" ? "finance.write" : "inventory.write",
        );
        await feature(
          s.tenant_id,
          name === "expenses" ? "sales_management" : "inventory",
          s.plan,
        );
        const d = schema.parse(req.body) as any;
        if (d.branch_id) sameBranch(s, d.branch_id);
        const keys = Object.keys(d);
        ok(
          res,
          await scoped(s.tenant_id, async (c) => {
            const r = (
              await c.query(
                `INSERT INTO ${name}(tenant_id,${keys.join(",")}) VALUES($1,${keys.map((_, i) => "$" + (i + 2)).join(",")}) RETURNING *`,
                [s.tenant_id, ...Object.values(d)],
              )
            ).rows[0];
            await audit(c, s.user_id, s.tenant_id, name + ".created", r.id);
            return r;
          }),
          201,
        );
      }),
    );
  }
  app.get(
    "/api/v1/inventory",
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
                "SELECT ib.*,p.name,p.sku,p.minimum_stock,p.expires_on,b.name branch_name FROM inventory_balances ib JOIN products p ON p.id=ib.product_id AND p.tenant_id=ib.tenant_id JOIN branches b ON b.id=ib.branch_id AND b.tenant_id=ib.tenant_id WHERE ib.tenant_id=$1 AND ($2::uuid IS NULL OR ib.branch_id=$2) ORDER BY p.name LIMIT 250",
                [s.tenant_id, s.branch_id],
              )
            ).rows,
        ),
      );
    }),
  );
  app.get(
    "/api/v1/inventory/movements",
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
                "SELECT m.*,p.name,b.name branch_name FROM inventory_movements m JOIN products p ON p.id=m.product_id AND p.tenant_id=m.tenant_id JOIN branches b ON b.id=m.branch_id AND b.tenant_id=m.tenant_id WHERE m.tenant_id=$1 AND ($2::uuid IS NULL OR m.branch_id=$2) ORDER BY created_at DESC LIMIT 200",
                [s.tenant_id, s.branch_id],
              )
            ).rows,
        ),
      );
    }),
  );
  app.post(
    "/api/v1/inventory/movements",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "inventory.write");
      await feature(s.tenant_id, "inventory", s.plan);
      const d = z
        .object({
          branch_id: uuid,
          product_id: uuid,
          quantity: z
            .number()
            .min(-100000)
            .max(100000)
            .refine((n) => n !== 0),
          reason: z.enum([
            "purchase",
            "adjustment",
            "damaged",
            "expired",
            "return",
          ]),
          transfer_to: uuid.optional(),
        })
        .parse(req.body);
      sameBranch(s, d.branch_id);
      if (d.transfer_to) {
        sameBranch(s, d.transfer_to);
        if (d.transfer_to === d.branch_id || d.quantity >= 0)
          throw new HttpError(
            422,
            "Transfer must deduct from the source branch and use a different destination",
          );
      }
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const r = await moveStock(
            c,
            s.tenant_id,
            d.branch_id,
            d.product_id,
            d.quantity,
            d.reason,
            s.user_id,
          );
          if (d.transfer_to)
            await moveStock(
              c,
              s.tenant_id,
              d.transfer_to,
              d.product_id,
              -d.quantity,
              "transfer",
              s.user_id,
            );
          await audit(
            c,
            s.user_id,
            s.tenant_id,
            "inventory." + (d.transfer_to ? "transfer" : d.reason),
            d.product_id,
          );
          return r;
        }),
        201,
      );
    }),
  );
  app.get(
    "/api/v1/service-consumables",
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
                "SELECT sc.*,s.name service_name,p.name product_name FROM service_consumables sc JOIN services s ON s.id=sc.service_id AND s.tenant_id=sc.tenant_id JOIN products p ON p.id=sc.product_id AND p.tenant_id=sc.tenant_id WHERE sc.tenant_id=$1 ORDER BY s.name",
                [s.tenant_id],
              )
            ).rows,
        ),
      );
    }),
  );
  app.post(
    "/api/v1/service-consumables",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "inventory.write");
      await feature(s.tenant_id, "inventory", s.plan);
      const d = z
        .object({
          service_id: uuid,
          product_id: uuid,
          quantity: z.number().positive().max(10000),
        })
        .parse(req.body);
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const r = (
            await c.query(
              "INSERT INTO service_consumables(tenant_id,service_id,product_id,quantity) VALUES($1,$2,$3,$4) ON CONFLICT(tenant_id,service_id,product_id) DO UPDATE SET quantity=$4 RETURNING *",
              [s.tenant_id, d.service_id, d.product_id, d.quantity],
            )
          ).rows[0];
          await audit(
            c,
            s.user_id,
            s.tenant_id,
            "service_consumption.updated",
            d.service_id,
          );
          return r;
        }),
        201,
      );
    }),
  );
  app.get(
    "/api/v1/orders",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "finance.read");
      await feature(s.tenant_id, "sales_management", s.plan);
      ok(
        res,
        await scoped(
          s.tenant_id,
          async (c) =>
            (
              await c.query(
                `SELECT o.*,cu.name customer_name,COALESCE((SELECT sum(amount_minor) FROM payments p WHERE p.tenant_id=o.tenant_id AND p.order_id=o.id),0) paid_minor,COALESCE((SELECT sum(r.amount_minor) FROM refunds r JOIN payments p ON p.id=r.payment_id AND p.tenant_id=r.tenant_id WHERE p.tenant_id=o.tenant_id AND p.order_id=o.id),0) refunded_minor FROM orders o JOIN customers cu ON cu.id=o.customer_id AND cu.tenant_id=o.tenant_id WHERE o.tenant_id=$1 AND ($2::uuid IS NULL OR o.branch_id=$2) ORDER BY created_at DESC LIMIT 100`,
                [s.tenant_id, s.branch_id],
              )
            ).rows,
        ),
      );
    }),
  );
  app.post(
    "/api/v1/orders",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "finance.write");
      await feature(s.tenant_id, "sales_management", s.plan);
      const d = z
        .object({
          branch_id: uuid,
          customer_id: uuid,
          appointment_id: uuid.optional(),
          items: z
            .array(
              z.object({
                kind: z.enum(["service", "product"]),
                id: uuid,
                quantity: z.number().int().min(1).max(100),
              }),
            )
            .max(30)
            .default([]),
          discount_minor: minor.default(0),
          idempotency_key: z.string().min(8).max(100),
        })
        .parse(req.body);
      sameBranch(s, d.branch_id);
      if (d.items.some((i) => i.kind === "product"))
        await feature(s.tenant_id, "inventory", s.plan);
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          await c.query(
            "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
            [s.tenant_id + d.idempotency_key],
          );
          const existing = (
            await c.query(
              "SELECT * FROM orders WHERE tenant_id=$1 AND idempotency_key=$2",
              [s.tenant_id, d.idempotency_key],
            )
          ).rows[0];
          if (existing) return existing;
          const items: any[] = [];
          if (d.appointment_id) {
            const a = (
              await c.query(
                "SELECT * FROM appointments WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
                [s.tenant_id, d.appointment_id],
              )
            ).rows[0];
            if (
              !a ||
              a.customer_id !== d.customer_id ||
              a.branch_id !== d.branch_id ||
              a.status !== "completed"
            )
              throw new HttpError(
                422,
                "Choose a completed appointment for this customer and branch",
              );
            const services = (
              await c.query(
                "SELECT aps.*,s.name FROM appointment_services aps JOIN services s ON s.id=aps.service_id AND s.tenant_id=aps.tenant_id WHERE aps.tenant_id=$1 AND aps.appointment_id=$2",
                [s.tenant_id, a.id],
              )
            ).rows;
            for (const sv of services)
              items.push({
                service_id: sv.service_id,
                product_id: null,
                name: sv.name,
                quantity: 1,
                price_minor: Number(sv.price_minor),
              });
          }
          for (const i of d.items) {
            const table = i.kind === "product" ? "products" : "services";
            const row = (
              await c.query(
                `SELECT * FROM ${table} WHERE tenant_id=$1 AND id=$2 AND active`,
                [s.tenant_id, i.id],
              )
            ).rows[0];
            if (!row) throw new HttpError(422, "An item is unavailable");
            items.push({
              service_id: i.kind === "service" ? i.id : null,
              product_id: i.kind === "product" ? i.id : null,
              name: row.name,
              quantity: i.quantity,
              price_minor: Number(row.price_minor),
            });
          }
          if (!items.length) throw new HttpError(422, "Add at least one item");
          const subtotal = items.reduce(
            (a, i) => a + i.price_minor * i.quantity,
            0,
          );
          if (d.discount_minor > subtotal)
            throw new HttpError(422, "Discount exceeds order value");
          const tenant = (
            await c.query(
              "SELECT tax_basis_points FROM tenants WHERE id=$1 FOR SHARE",
              [s.tenant_id],
            )
          ).rows[0];
          const tax = Math.round(
              ((subtotal - d.discount_minor) * tenant.tax_basis_points) / 10000,
            ),
            total = subtotal - d.discount_minor + tax;
          const order = (
            await c.query(
              "INSERT INTO orders(tenant_id,branch_id,customer_id,appointment_id,subtotal_minor,discount_minor,tax_minor,total_minor,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
              [
                s.tenant_id,
                d.branch_id,
                d.customer_id,
                d.appointment_id || null,
                subtotal,
                d.discount_minor,
                tax,
                total,
                d.idempotency_key,
              ],
            )
          ).rows[0];
          for (const i of items) {
            await c.query(
              "INSERT INTO order_items(tenant_id,order_id,service_id,product_id,name,quantity,price_minor) VALUES($1,$2,$3,$4,$5,$6,$7)",
              [
                s.tenant_id,
                order.id,
                i.service_id,
                i.product_id,
                i.name,
                i.quantity,
                i.price_minor,
              ],
            );
            if (i.product_id)
              await moveStock(
                c,
                s.tenant_id,
                d.branch_id,
                i.product_id,
                -i.quantity,
                "retail_sale",
                s.user_id,
                order.id,
              );
          }
          await audit(c, s.user_id, s.tenant_id, "order.created", order.id);
          return order;
        }),
        201,
      );
    }),
  );
  app.post(
    "/api/v1/orders/:id/payments",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "finance.write");
      await feature(s.tenant_id, "sales_management", s.plan);
      const id = uuid.parse(req.params.id),
        d = z
          .object({
            amount_minor: minor.refine((n) => n > 0),
            method: z.enum([
              "cash",
              "card",
              "bank_transfer",
              "zelle",
              "venmo",
              "cash_app",
              "other",
            ]),
            idempotency_key: z.string().min(8).max(100),
          })
          .parse(req.body);
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const o = (
            await c.query(
              "SELECT * FROM orders WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
              [s.tenant_id, id],
            )
          ).rows[0];
          if (!o) throw new HttpError(404, "Order not found");
          const methods = (
            await c.query("SELECT payment_methods FROM tenants WHERE id=$1", [
              s.tenant_id,
            ])
          ).rows[0].payment_methods;
          if (!methods.includes(d.method))
            throw new HttpError(
              422,
              "This payment method is disabled for this salon.",
            );
          sameBranch(s, o.branch_id);
          const prior = (
            await c.query(
              "SELECT * FROM payments WHERE tenant_id=$1 AND idempotency_key=$2",
              [s.tenant_id, d.idempotency_key],
            )
          ).rows[0];
          if (prior) {
            if (
              prior.order_id !== id ||
              Number(prior.amount_minor) !== d.amount_minor ||
              prior.method !== d.method
            )
              throw new HttpError(
                409,
                "Idempotency key was used for a different payment",
              );
            return prior;
          }
          if (
            (
              await c.query(
                "SELECT 1 FROM gateway_checkouts WHERE tenant_id=$1 AND order_id=$2 AND status='pending' AND expires_at>now()",
                [s.tenant_id, id],
              )
            ).rowCount
          )
            throw new HttpError(
              409,
              "An online checkout is active for this order",
            );
          const paid = Number(
            (
              await c.query(
                "SELECT COALESCE(sum(amount_minor),0) total FROM payments WHERE tenant_id=$1 AND order_id=$2",
                [s.tenant_id, id],
              )
            ).rows[0].total,
          );
          if (
            o.status !== "open" ||
            paid + d.amount_minor > Number(o.total_minor)
          )
            throw new HttpError(
              409,
              "Payment exceeds the outstanding balance or order is closed",
            );
          const p = (
            await c.query(
              "INSERT INTO payments(tenant_id,order_id,amount_minor,method,idempotency_key) VALUES($1,$2,$3,$4,$5) RETURNING *",
              [s.tenant_id, id, d.amount_minor, d.method, d.idempotency_key],
            )
          ).rows[0];
          if (paid + d.amount_minor === Number(o.total_minor))
            await c.query(
              "UPDATE orders SET status='paid' WHERE tenant_id=$1 AND id=$2",
              [s.tenant_id, id],
            );
          await audit(c, s.user_id, s.tenant_id, "payment.recorded", p.id);
          return p;
        }),
        201,
      );
    }),
  );
  app.get(
    "/api/v1/payments",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "finance.read");
      await feature(s.tenant_id, "sales_management", s.plan);
      ok(
        res,
        await scoped(
          s.tenant_id,
          async (c) =>
            (
              await c.query(
                "SELECT p.*,cu.name customer_name FROM payments p JOIN orders o ON o.id=p.order_id AND o.tenant_id=p.tenant_id JOIN customers cu ON cu.id=o.customer_id AND cu.tenant_id=o.tenant_id WHERE p.tenant_id=$1 AND ($2::uuid IS NULL OR o.branch_id=$2) ORDER BY p.created_at DESC LIMIT 100",
                [s.tenant_id, s.branch_id],
              )
            ).rows,
        ),
      );
    }),
  );
  app.post(
    "/api/v1/payments/:id/refunds",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "finance.write");
      await feature(s.tenant_id, "sales_management", s.plan);
      const id = uuid.parse(req.params.id),
        d = z
          .object({
            amount_minor: minor.refine((n) => n > 0),
            reason: z.string().min(3).max(500),
            idempotency_key: z.string().min(8).max(100),
          })
          .parse(req.body);
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const p = (
            await c.query(
              "SELECT p.*,o.branch_id FROM payments p JOIN orders o ON o.id=p.order_id AND o.tenant_id=p.tenant_id WHERE p.tenant_id=$1 AND p.id=$2 FOR UPDATE OF p,o",
              [s.tenant_id, id],
            )
          ).rows[0];
          if (!p) throw new HttpError(404, "Payment not found");
          sameBranch(s, p.branch_id);
          if (p.method === "stripe")
            throw new HttpError(
              409,
              "Stripe refunds must be issued through the gateway",
            );
          const prior = (
            await c.query(
              "SELECT * FROM refunds WHERE tenant_id=$1 AND idempotency_key=$2",
              [s.tenant_id, d.idempotency_key],
            )
          ).rows[0];
          if (prior) {
            if (
              prior.payment_id !== id ||
              Number(prior.amount_minor) !== d.amount_minor
            )
              throw new HttpError(409, "Idempotency key mismatch");
            return prior;
          }
          const refunded = Number(
            (
              await c.query(
                "SELECT COALESCE(sum(amount_minor),0) total FROM refunds WHERE tenant_id=$1 AND payment_id=$2",
                [s.tenant_id, id],
              )
            ).rows[0].total,
          );
          if (refunded + d.amount_minor > Number(p.amount_minor))
            throw new HttpError(409, "Refund exceeds this payment");
          const r = (
            await c.query(
              "INSERT INTO refunds(tenant_id,payment_id,amount_minor,reason,idempotency_key) VALUES($1,$2,$3,$4,$5) RETURNING *",
              [s.tenant_id, id, d.amount_minor, d.reason, d.idempotency_key],
            )
          ).rows[0];
          await c.query(
            "UPDATE orders SET status='partially_refunded' WHERE tenant_id=$1 AND id=$2",
            [s.tenant_id, p.order_id],
          );
          await audit(c, s.user_id, s.tenant_id, "refund.recorded", r.id);
          return r;
        }),
        201,
      );
    }),
  );
  app.get(
    "/api/v1/commissions",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "payroll.read");
      await feature(s.tenant_id, "employees", s.plan);
      ok(
        res,
        await scoped(
          s.tenant_id,
          async (c) =>
            (
              await c.query(
                "SELECT cm.*,e.name employee_name FROM commissions cm JOIN employees e ON e.id=cm.employee_id AND e.tenant_id=cm.tenant_id WHERE cm.tenant_id=$1 AND ($2::uuid IS NULL OR e.branch_id=$2) ORDER BY cm.created_at DESC LIMIT 100",
                [s.tenant_id, s.branch_id],
              )
            ).rows,
        ),
      );
    }),
  );
}
