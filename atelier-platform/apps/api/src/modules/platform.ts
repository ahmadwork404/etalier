import type express from "express";
import { z } from "zod";
import { pool, transaction, scoped, audit } from "../db.js";
import { HttpError } from "../security.js";
import { wrap, ok, platform } from "../runtime.js";
import { paymentMethods } from "../services/quick-work.js";
const uuid = z.string().uuid();
export function register(app: express.Express) {
  app.get(
    "/api/v1/admin/tenants",
    wrap(async (req, res) => {
      await platform(req);
      const shops = (
        await pool.query(
          "SELECT id,name,slug,status,plan,max_locations,payment_methods,created_at FROM tenants ORDER BY created_at DESC LIMIT 500",
        )
      ).rows;
      for (const shop of shops)
        Object.assign(
          shop,
          await scoped(
            shop.id,
            async (c) =>
              (
                await c.query(
                  "SELECT (SELECT count(*)::integer FROM branches WHERE tenant_id=$1) location_count,(SELECT count(*)::integer FROM memberships WHERE tenant_id=$1 AND active) member_count",
                  [shop.id],
                )
              ).rows[0],
          ),
        );
      ok(res, shops);
    }),
  );
  app.patch(
    "/api/v1/admin/tenants/:id",
    wrap(async (req, res) => {
      const admin = await platform(req),
        id = uuid.parse(req.params.id);
      const changes = z
        .object({
          status: z.enum(["active", "suspended"]).optional(),
          max_locations: z.number().int().min(1).max(1000).optional(),
          payment_methods: z
            .array(z.enum(paymentMethods))
            .min(1)
            .max(8)
            .refine(
              (values) => new Set(values).size === values.length,
              "Choose each method once",
            )
            .optional(),
        })
        .refine((value) => Object.keys(value).length > 0)
        .parse(req.body);
      await scoped(id, async (c) => {
        const shop = (
          await c.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [id])
        ).rows[0];
        if (!shop) throw new HttpError(404, "Shop not found");
        await c.query(
          "UPDATE tenants SET status=COALESCE($2,status),max_locations=COALESCE($3,max_locations),payment_methods=COALESCE($4::text[],payment_methods),updated_at=now() WHERE id=$1",
          [
            id,
            changes.status ?? null,
            changes.max_locations ?? null,
            changes.payment_methods ?? null,
          ],
        );
        await audit(c, admin.user_id, id, "admin.shop.updated", id);
      });
      ok(res, { updated: true });
    }),
  );
  app.get(
    "/api/v1/admin/tenants/:id/members",
    wrap(async (req, res) => {
      await platform(req);
      const id = uuid.parse(req.params.id);
      ok(
        res,
        await scoped(
          id,
          async (c) =>
            (
              await c.query(
                "SELECT m.id,m.user_id,m.active,u.name,u.email,u.suspended,r.name role_name,r.is_owner FROM memberships m JOIN users u ON u.id=m.user_id JOIN roles r ON r.id=m.role_id AND r.tenant_id=m.tenant_id WHERE m.tenant_id=$1 ORDER BY u.name",
                [id],
              )
            ).rows,
        ),
      );
    }),
  );
  app.patch(
    "/api/v1/admin/tenants/:id/members/:memberId",
    wrap(async (req, res) => {
      const admin = await platform(req),
        id = uuid.parse(req.params.id),
        memberId = uuid.parse(req.params.memberId);
      const { active } = z.object({ active: z.boolean() }).parse(req.body);
      await scoped(id, async (c) => {
        const member = (
          await c.query(
            "UPDATE memberships SET active=$3 WHERE tenant_id=$1 AND id=$2 RETURNING user_id",
            [id, memberId, active],
          )
        ).rows[0];
        if (!member) throw new HttpError(404, "Member not found");
        if (!active)
          await c.query(
            "UPDATE sessions SET tenant_id=NULL WHERE tenant_id=$1 AND user_id=$2",
            [id, member.user_id],
          );
        await audit(
          c,
          admin.user_id,
          id,
          active ? "admin.member.enabled" : "admin.member.disabled",
          member.user_id,
        );
      });
      ok(res, { updated: true });
    }),
  );
  app.delete(
    "/api/v1/admin/tenants/:id/members/:memberId",
    wrap(async (req, res) => {
      const admin = await platform(req),
        id = uuid.parse(req.params.id),
        memberId = uuid.parse(req.params.memberId);
      await scoped(id, async (c) => {
        const member = (
          await c.query(
            "DELETE FROM memberships WHERE tenant_id=$1 AND id=$2 RETURNING user_id",
            [id, memberId],
          )
        ).rows[0];
        if (!member) throw new HttpError(404, "Member not found");
        await c.query(
          "UPDATE sessions SET tenant_id=NULL WHERE tenant_id=$1 AND user_id=$2",
          [id, member.user_id],
        );
        await audit(
          c,
          admin.user_id,
          id,
          "admin.member.removed",
          member.user_id,
        );
      });
      ok(res, { removed: true });
    }),
  );
  app.get(
    "/api/v1/admin/features",
    wrap(async (req, res) => {
      await platform(req);
      ok(res, (await pool.query("SELECT * FROM features ORDER BY name")).rows);
    }),
  );
  app.get(
    "/api/v1/admin/tenants/:id/features",
    wrap(async (req, res) => {
      await platform(req);
      const id = uuid.parse(req.params.id);
      ok(
        res,
        await scoped(
          id,
          async (c) =>
            (
              await c.query(
                "SELECT f.*,COALESCE(tf.enabled,false) tenant_enabled,COALESCE(tf.admin_enabled,true) admin_enabled FROM features f LEFT JOIN tenant_features tf ON tf.feature_key=f.key AND tf.tenant_id=$1 ORDER BY f.name",
                [id],
              )
            ).rows,
        ),
      );
    }),
  );
  app.patch(
    "/api/v1/admin/features/:key",
    wrap(async (req, res) => {
      const admin = await platform(req),
        key = z.string().max(80).parse(req.params.key);
      const data = z
        .object({ enabled: z.boolean(), tenant_id: uuid.optional() })
        .parse(req.body);
      await transaction(async (c) => {
        if (
          !(await c.query("SELECT 1 FROM features WHERE key=$1", [key]))
            .rowCount
        )
          throw new HttpError(404, "Module not found");
        if (data.tenant_id) {
          if (
            !(
              await c.query("SELECT 1 FROM tenants WHERE id=$1", [
                data.tenant_id,
              ])
            ).rowCount
          )
            throw new HttpError(404, "Shop not found");
          await c.query("SELECT set_config('app.tenant_id',$1,true)", [
            data.tenant_id,
          ]);
          await c.query(
            "INSERT INTO tenant_features(tenant_id,feature_key,enabled,admin_enabled) VALUES($1,$2,false,$3) ON CONFLICT(tenant_id,feature_key) DO UPDATE SET admin_enabled=$3",
            [data.tenant_id, key, data.enabled],
          );
        } else
          await c.query("UPDATE features SET enabled=$2 WHERE key=$1", [
            key,
            data.enabled,
          ]);
        await audit(
          c,
          admin.user_id,
          data.tenant_id || null,
          "admin.module." + (data.enabled ? "allowed" : "blocked"),
          key,
        );
      });
      ok(res, { updated: true });
    }),
  );
  app.get(
    "/api/v1/admin/audit",
    wrap(async (req, res) => {
      await platform(req);
      const filters = z
        .object({
          q: z.string().max(200).default(""),
          shop: uuid.optional(),
          user: uuid.optional(),
          page: z.coerce.number().int().min(1).max(100000).default(1),
        })
        .parse(req.query);
      const rows = (
        await pool.query(
          "SELECT a.id,a.actor_id,a.tenant_id,a.action,a.target_id,a.metadata,a.created_at,u.name actor_name,u.email actor_email,t.name shop_name FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id LEFT JOIN tenants t ON t.id=a.tenant_id WHERE ($1::uuid IS NULL OR a.tenant_id=$1) AND ($2::uuid IS NULL OR a.actor_id=$2) AND (a.action ILIKE $3 OR u.name ILIKE $3 OR u.email ILIKE $3 OR t.name ILIKE $3) ORDER BY a.created_at DESC,a.id DESC LIMIT 51 OFFSET $4",
          [
            filters.shop || null,
            filters.user || null,
            "%" + filters.q + "%",
            (filters.page - 1) * 50,
          ],
        )
      ).rows;
      ok(res, { items: rows.slice(0, 50), hasMore: rows.length > 50 });
    }),
  );
  app.get(
    "/api/v1/admin/jobs",
    wrap(async (req, res) => {
      await platform(req);
      ok(
        res,
        (
          await pool.query(
            "SELECT status,count(*)::integer count FROM jobs GROUP BY status",
          )
        ).rows,
      );
    }),
  );
}
