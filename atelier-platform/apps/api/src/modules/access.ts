import { portalUrl } from "../services/public-urls.js";
import type express from "express";
import { z } from "zod";
import argon2 from "argon2";
import { pool, scoped, transaction, audit } from "../db.js";
import {
  wrap,
  ok,
  session,
  tenantContext,
  authLimit,
  credentials,
} from "../runtime.js";
import { digest, newToken, HttpError, permissionKeys } from "../security.js";
import { sendEmail, integrationStatus } from "../services/providers.js";
export function register(app: express.Express) {
  app.get(
    "/api/v1/access",
    wrap(async (req, res) => {
      const s = await tenantContext(req);
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const membership = (
            await c.query(
              "SELECT role_id FROM memberships WHERE tenant_id=$1 AND user_id=$2 AND active",
              [s.tenant_id, s.user_id],
            )
          ).rows[0];
          const permissions = s.is_owner
            ? [...permissionKeys]
            : (
                await c.query(
                  "SELECT permission FROM role_permissions WHERE role_id=$1",
                  [membership.role_id],
                )
              ).rows.map((r) => r.permission);
          return {
            permissions,
            payment_methods: (
              await c.query("SELECT payment_methods FROM tenants WHERE id=$1", [
                s.tenant_id,
              ])
            ).rows[0].payment_methods,
            is_owner: s.is_owner,
            branch_id: s.branch_id,
            plan: s.plan,
            max_locations: s.max_locations,
            location_count: Number(
              (
                await c.query(
                  "SELECT count(*) FROM branches WHERE tenant_id=$1",
                  [s.tenant_id],
                )
              ).rows[0].count,
            ),
          };
        }),
      );
    }),
  );
  app.get(
    "/api/v1/integrations",
    wrap(async (req, res) => {
      await tenantContext(req, "settings.manage");
      ok(res, integrationStatus());
    }),
  );
  app.get(
    "/api/v1/members",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "roles.manage");
      ok(
        res,
        await scoped(
          s.tenant_id,
          async (c) =>
            (
              await c.query(
                "SELECT m.id,m.user_id,m.role_id,m.branch_id,m.active,u.name,u.email,r.name role_name,r.is_owner FROM memberships m JOIN users u ON u.id=m.user_id JOIN roles r ON r.id=m.role_id AND r.tenant_id=m.tenant_id WHERE m.tenant_id=$1",
                [s.tenant_id],
              )
            ).rows,
        ),
      );
    }),
  );
  app.patch(
    "/api/v1/members/:id",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "roles.manage");
      if (!s.is_owner)
        throw new HttpError(403, "Only owners can assign permissions");
      const id = z.string().uuid().parse(req.params.id),
        d = z
          .object({
            role_id: z.string().uuid(),
            branch_id: z.string().uuid().nullable(),
            active: z.boolean(),
          })
          .parse(req.body);
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const member = (
            await c.query(
              "SELECT m.*,r.is_owner FROM memberships m JOIN roles r ON r.id=m.role_id AND r.tenant_id=m.tenant_id WHERE m.tenant_id=$1 AND m.id=$2 FOR UPDATE OF m",
              [s.tenant_id, id],
            )
          ).rows[0];
          if (!member) throw new HttpError(404, "Member not found");
          if (member.is_owner || member.user_id === s.user_id)
            throw new HttpError(403, "Owner membership cannot be changed here");
          const role = (
            await c.query("SELECT * FROM roles WHERE tenant_id=$1 AND id=$2", [
              s.tenant_id,
              d.role_id,
            ])
          ).rows[0];
          if (!role || role.is_owner)
            throw new HttpError(403, "Choose a non-owner role");
          await c.query(
            "UPDATE memberships SET role_id=$3,branch_id=$4,active=$5 WHERE tenant_id=$1 AND id=$2",
            [s.tenant_id, id, d.role_id, d.branch_id, d.active],
          );
          await audit(c, s.user_id, s.tenant_id, "membership.updated", id);
          return { updated: true };
        }),
      );
    }),
  );
  app.patch(
    "/api/v1/roles/:id",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "roles.manage");
      if (!s.is_owner)
        throw new HttpError(403, "Only owners can edit permissions");
      const id = z.string().uuid().parse(req.params.id),
        d = z
          .object({
            name: z.string().min(2).max(80),
            permissions: z.array(z.enum(permissionKeys)).max(100),
          })
          .parse(req.body);
      ok(
        res,
        await scoped(s.tenant_id, async (c) => {
          const r = (
            await c.query(
              "SELECT * FROM roles WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
              [s.tenant_id, id],
            )
          ).rows[0];
          if (!r || r.is_owner)
            throw new HttpError(403, "This role cannot be edited");
          await c.query(
            "UPDATE roles SET name=$3 WHERE tenant_id=$1 AND id=$2",
            [s.tenant_id, id, d.name],
          );
          await c.query("DELETE FROM role_permissions WHERE role_id=$1", [id]);
          for (const p of new Set(d.permissions))
            await c.query(
              "INSERT INTO role_permissions(role_id,permission) VALUES($1,$2)",
              [id, p],
            );
          await audit(c, s.user_id, s.tenant_id, "role.updated", id);
          return { updated: true };
        }),
      );
    }),
  );
  app.post(
    "/api/v1/invitations",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "roles.manage");
      if (!s.is_owner)
        throw new HttpError(403, "Only owners can invite team members");
      const d = z
          .object({
            email: z
              .string()
              .email()
              .transform((v) => v.toLowerCase()),
            role_id: z.string().uuid(),
            branch_id: z.string().uuid().optional(),
          })
          .parse(req.body),
        token = newToken();
      await scoped(s.tenant_id, async (c) => {
        const r = (
          await c.query("SELECT * FROM roles WHERE tenant_id=$1 AND id=$2", [
            s.tenant_id,
            d.role_id,
          ])
        ).rows[0];
        if (!r || r.is_owner)
          throw new HttpError(403, "Choose a non-owner role");
        await c.query(
          "INSERT INTO action_tokens(token_hash,purpose,tenant_id,email,role_id,branch_id,expires_at) VALUES($1,'invitation',$2,$3,$4,$5,now()+interval '7 days')",
          [digest(token), s.tenant_id, d.email, d.role_id, d.branch_id || null],
        );
        await audit(c, s.user_id, s.tenant_id, "invitation.created");
      });
      let email_status = "not_configured";
      if (integrationStatus().resend) {
        try {
          await sendEmail(
            d.email,
            "You’re invited to Etalier",
            "Your team invitation",
            "invite:" + digest(token),
            {
              content: {
                title: "Your team invitation",
                preview: "You’ve been invited to join your team on Etalier.",
                paragraphs: [
                  "You’ve been invited to join a salon workspace on Etalier.",
                  "Use the button below to accept the invitation. This link expires in seven days. If you weren’t expecting an invitation, you can ignore this email.",
                ],
                action: {
                  label: "Accept invitation",
                  url: portalUrl() + "/invite?token=" + token,
                },
              },
            },
          );
          email_status = "sent";
        } catch {
          email_status = "failed";
        }
      }
      ok(
        res,
        {
          url: portalUrl() + "/invite?token=" + token,
          expiresInDays: 7,
          email_status,
        },
        201,
      );
    }),
  );
  app.post(
    "/api/v1/invitations/accept",
    wrap(async (req, res) => {
      const s = await session(req),
        d = z.object({ token: z.string().min(30).max(100) }).parse(req.body);
      await transaction(async (c) => {
        const t = (
          await c.query(
            "SELECT * FROM action_tokens WHERE token_hash=$1 AND purpose='invitation' AND used_at IS NULL AND expires_at>now() FOR UPDATE",
            [digest(d.token)],
          )
        ).rows[0];
        if (!t || t.email !== s.email)
          throw new HttpError(
            403,
            "Invitation expired or belongs to a different email",
          );
        await c.query("SELECT set_config('app.tenant_id',$1,true)", [
          t.tenant_id,
        ]);
        await c.query(
          "INSERT INTO memberships(tenant_id,user_id,role_id,branch_id) VALUES($1,$2,$3,$4)",
          [t.tenant_id, s.user_id, t.role_id, t.branch_id],
        );
        await c.query("UPDATE action_tokens SET used_at=now() WHERE id=$1", [
          t.id,
        ]);
        await audit(c, s.user_id, t.tenant_id, "invitation.accepted", t.id);
      });
      ok(res, { accepted: true });
    }),
  );
  app.post(
    "/api/v1/auth/request-reset",
    authLimit,
    wrap(async (req, res) => {
      const d = z
        .object({
          email: z
            .string()
            .email()
            .transform((v) => v.toLowerCase()),
        })
        .parse(req.body);
      if (!integrationStatus().resend)
        throw new HttpError(503, "Email delivery is not configured");
      const u = (
        await pool.query(
          "SELECT id FROM users WHERE email=$1 AND NOT suspended",
          [d.email],
        )
      ).rows[0];
      if (u) {
        const token = newToken(),
          id = newToken();
        await pool.query(
          "INSERT INTO action_tokens(token_hash,purpose,user_id,expires_at) VALUES($1,'reset',$2,now()+interval '30 minutes')",
          [digest(token), u.id],
        );
        await sendEmail(
          d.email,
          "Reset your Atelier password",
          "Use this link within 30 minutes: " +
            portalUrl() +
            "/reset?token=" +
            token,
          id,
        );
      }
      ok(res, {
        message: "If the account exists, a reset email has been requested.",
      });
    }),
  );
  app.post(
    "/api/v1/auth/reset",
    authLimit,
    wrap(async (req, res) => {
      const d = z
          .object({
            token: z.string().min(30).max(100),
            password: credentials.shape.password,
          })
          .parse(req.body),
        hash = await argon2.hash(d.password, { type: argon2.argon2id });
      await transaction(async (c) => {
        const t = (
          await c.query(
            "SELECT * FROM action_tokens WHERE token_hash=$1 AND purpose='reset' AND used_at IS NULL AND expires_at>now() FOR UPDATE",
            [digest(d.token)],
          )
        ).rows[0];
        if (!t) throw new HttpError(403, "Reset link expired or already used");
        await c.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
          hash,
          t.user_id,
        ]);
        await c.query(
          "UPDATE action_tokens SET used_at=now() WHERE user_id=$1 AND purpose=$2 AND used_at IS NULL",
          [t.user_id, "reset"],
        );
        await c.query("DELETE FROM sessions WHERE user_id=$1", [t.user_id]);
        await audit(c, t.user_id, null, "auth.password_reset");
      });
      ok(res, { reset: true });
    }),
  );
  app.post(
    "/api/v1/auth/request-verification",
    authLimit,
    wrap(async (req, res) => {
      const s = await session(req);
      if (!integrationStatus().resend)
        throw new HttpError(503, "Email delivery is not configured");
      const token = newToken();
      await pool.query(
        "INSERT INTO action_tokens(token_hash,purpose,user_id,expires_at) VALUES($1,'verify',$2,now()+interval '1 day')",
        [digest(token), s.user_id],
      );
      await sendEmail(
        s.email,
        "Verify your Atelier email",
        "Verify your email: " + portalUrl() + "/verify?token=" + token,
        newToken(),
      );
      ok(res, { requested: true });
    }),
  );
  app.post(
    "/api/v1/auth/verify",
    authLimit,
    wrap(async (req, res) => {
      const d = z
        .object({ token: z.string().min(30).max(100) })
        .parse(req.body);
      await transaction(async (c) => {
        const t = (
          await c.query(
            "SELECT * FROM action_tokens WHERE token_hash=$1 AND purpose='verify' AND used_at IS NULL AND expires_at>now() FOR UPDATE",
            [digest(d.token)],
          )
        ).rows[0];
        if (!t)
          throw new HttpError(403, "Verification link expired or already used");
        await c.query("UPDATE users SET email_verified_at=now() WHERE id=$1", [
          t.user_id,
        ]);
        await c.query("UPDATE action_tokens SET used_at=now() WHERE id=$1", [
          t.id,
        ]);
        await audit(c, t.user_id, null, "auth.email_verified");
      });
      ok(res, { verified: true });
    }),
  );
}
