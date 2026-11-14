import type express from "express";
import argon2 from "argon2";
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
    "/api/v1/auth/register",
    authLimit,
    wrap(async (req, res) => {
      const d = credentials
        .extend({ name: z.string().trim().min(2).max(100) })
        .parse(req.body);
      const hash = await argon2.hash(d.password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
      });
      const user = await transaction(async (c) => {
        const { rows } = await c.query(
          "INSERT INTO users(email,password_hash,name) VALUES($1,$2,$3) RETURNING id,name,email",
          [d.email, hash, d.name],
        );
        await audit(c, rows[0].id, null, "auth.register");
        return rows[0];
      });
      ok(res, user, 201);
    }),
  );
  app.post(
    "/api/v1/auth/login",
    authLimit,
    wrap(async (req, res) => {
      const d = credentials.parse(req.body);
      const { rows } = await pool.query("SELECT * FROM users WHERE email=$1", [
        d.email,
      ]);
      const u = rows[0];
      if (
        !u ||
        u.suspended ||
        !(await argon2.verify(u.password_hash, d.password))
      ) {
        await pool.query(
          "INSERT INTO audit_logs(actor_id,action) VALUES($1,'auth.login_failed')",
          [u?.id || null],
        );
        throw new HttpError(401, "Invalid email or password");
      }
      const token = newToken();
      let selectedTenantId: string | null = null;
      await transaction(async (c) => {
        const salons = await c.query(
          "SELECT id FROM my_workspaces($1) WHERE status='active'",
          [u.id],
        );
        if (!u.platform_role && salons.rows.length === 1)
          selectedTenantId = salons.rows[0].id;
        await c.query(
          "INSERT INTO sessions(user_id,token_hash,tenant_id,expires_at) VALUES($1,$2,$3,now()+interval '7 days')",
          [u.id, digest(token), selectedTenantId],
        );
        await audit(c, u.id, null, "auth.login");
      });
      res.cookie("atelier_session", token, cookieOptions);
      ok(res, {
        id: u.id,
        name: u.name,
        email: u.email,
        platform_role: u.platform_role,
        tenant_id: selectedTenantId,
      });
    }),
  );
  app.get(
    "/api/v1/auth/me",
    wrap(async (req, res) => ok(res, await session(req))),
  );
  app.post(
    "/api/v1/auth/refresh",
    wrap(async (req, res) => {
      const current = req.cookies.atelier_session;
      if (!current) throw new HttpError(401, "Session expired");
      const token = newToken();
      await transaction(async (c) => {
        const { rows } = await c.query(
          "SELECT s.*,u.suspended FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=$1 AND expires_at>now() FOR UPDATE OF s",
          [digest(current)],
        );
        if (!rows[0] || rows[0].suspended)
          throw new HttpError(401, "Session expired");
        await c.query(
          "UPDATE sessions SET token_hash=$1,expires_at=now()+interval '7 days' WHERE id=$2",
          [digest(token), rows[0].id],
        );
      });
      res.cookie("atelier_session", token, cookieOptions);
      ok(res, { rotated: true });
    }),
  );
  app.post(
    "/api/v1/auth/logout",
    wrap(async (req, res) => {
      if (req.cookies.atelier_session)
        await pool.query("DELETE FROM sessions WHERE token_hash=$1", [
          digest(req.cookies.atelier_session),
        ]);
      res.clearCookie("atelier_session", { path: "/api" });
      ok(res, { loggedOut: true });
    }),
  );
  app.post(
    "/api/v1/auth/revoke-all",
    wrap(async (req, res) => {
      const s = await session(req);
      await transaction(async (c) => {
        await c.query("DELETE FROM sessions WHERE user_id=$1", [s.user_id]);
        await audit(c, s.user_id, null, "auth.revoke_all");
      });
      res.clearCookie("atelier_session", { path: "/api" });
      ok(res, { revoked: true });
    }),
  );
  app.post(
    "/api/v1/auth/password",
    authLimit,
    wrap(async (req, res) => {
      const s = await session(req);
      const d = z
        .object({
          currentPassword: z.string(),
          password: credentials.shape.password,
        })
        .parse(req.body);
      const { rows } = await pool.query(
        "SELECT password_hash FROM users WHERE id=$1",
        [s.user_id],
      );
      if (!(await argon2.verify(rows[0].password_hash, d.currentPassword)))
        throw new HttpError(401, "Incorrect password");
      const hash = await argon2.hash(d.password, { type: argon2.argon2id });
      await transaction(async (c) => {
        await c.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
          hash,
          s.user_id,
        ]);
        await c.query("DELETE FROM sessions WHERE user_id=$1", [s.user_id]);
        await audit(c, s.user_id, null, "auth.password_changed");
      });
      res.clearCookie("atelier_session", { path: "/api" });
      ok(res, { signInAgain: true });
    }),
  );
}
