import type express from "express";
import passwords from "../services/passwords.js";
import { z } from "zod";
import { pool, transaction, scoped, audit } from "../db.js";
import {
  digest,
  newToken,
  HttpError,
  permissionKeys,
  featureAllowed,
} from "../security.js";
import {
  wrap,
  ok,
  authLimit,
  cookieOptions,
  credentials,
  session,
  tenantContext,
  feature,
  platform,
} from "../runtime.js";

export function register(app: express.Express) {
  app.post(
    "/api/v1/tenants",
    wrap(async (req, res) => {
      const s = await session(req);
      if (s.platform_role)
        throw new HttpError(
          403,
          "Platform accounts cannot create or select shops",
        );
      const d = z
        .object({
          name: z
            .string()
            .trim()
            .min(2, "Enter a salon name with at least 2 characters.")
            .max(100, "Keep the salon name to 100 characters or fewer."),
          slug: z
            .string()
            .min(3, "Use at least 3 characters for the booking link address.")
            .max(63, "Keep the booking link address to 63 characters or fewer.")
            .regex(
              /^[a-z][a-z0-9-]+$/,
              "Start with a lowercase letter and use only lowercase letters, numbers and hyphens.",
            ),
        })
        .parse(req.body);
      const tenant = await transaction(async (c) => {
        await c.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
          s.user_id,
        ]);
        if (
          (
            await c.query("SELECT 1 FROM my_workspaces($1) LIMIT 1", [
              s.user_id,
            ])
          ).rowCount
        ) {
          throw new HttpError(
            403,
            "Your account already belongs to a salon. Create workspaces inside that salon; its workspace allowance applies.",
          );
        }
        const { rows } = await c.query(
          "INSERT INTO tenants(name,slug,currency) VALUES($1,$2,'USD') RETURNING *",
          [d.name, d.slug],
        );
        const t = rows[0];
        await c.query("SELECT set_config('app.tenant_id',$1,true)", [t.id]);
        const role = (
          await c.query(
            "INSERT INTO roles(tenant_id,name,is_owner) VALUES($1,'Business owner',true) RETURNING id",
            [t.id],
          )
        ).rows[0];
        await c.query(
          "INSERT INTO memberships(tenant_id,user_id,role_id) VALUES($1,$2,$3)",
          [t.id, s.user_id, role.id],
        );
        await c.query(
          "INSERT INTO branches(tenant_id,name) VALUES($1,'Main salon')",
          [t.id],
        );
        await c.query(
          "INSERT INTO tenant_features(tenant_id,feature_key,enabled) SELECT $1,key,enabled FROM features",
          [t.id],
        );
        await c.query("UPDATE sessions SET tenant_id=$1 WHERE id=$2", [
          t.id,
          s.session_id,
        ]);
        await audit(c, s.user_id, t.id, "tenant.created", t.id);
        return t;
      }).catch((error) => {
        if (error.code === "23505" && error.constraint === "tenants_slug_key") {
          throw new z.ZodError([
            {
              code: "custom",
              path: ["slug"],
              message:
                "This booking link address is already taken. Choose another address.",
            },
          ]);
        }
        throw error;
      });
      ok(res, tenant, 201);
    }),
  );
  // Membership enumeration uses a narrowly scoped SECURITY DEFINER function in production deployments.
  app.get(
    "/api/v1/tenants",
    wrap(async (req, res) => {
      const s = await session(req);
      if (s.platform_role) return ok(res, []);
      const { rows } = await pool.query("SELECT * FROM my_workspaces($1)", [
        s.user_id,
      ]);
      ok(res, rows);
    }),
  );
  app.post(
    "/api/v1/tenants/select",
    wrap(async (req, res) => {
      const s = await session(req);
      if (s.platform_role)
        throw new HttpError(
          403,
          "Platform accounts cannot create or select shops",
        );
      const { id } = z.object({ id: z.string().uuid() }).parse(req.body);
      await scoped(id, async (c) => {
        if (
          !(
            await c.query(
              "SELECT 1 FROM memberships m JOIN tenants t ON t.id=m.tenant_id WHERE m.tenant_id=$1 AND m.user_id=$2 AND m.active AND t.status='active'",
              [id, s.user_id],
            )
          ).rowCount
        )
          throw new HttpError(403, "Workspace unavailable");
        await c.query("UPDATE sessions SET tenant_id=$1 WHERE id=$2", [
          id,
          s.session_id,
        ]);
        await audit(c, s.user_id, id, "tenant.selected", id);
      });
      ok(res, { selected: id });
    }),
  );
}
