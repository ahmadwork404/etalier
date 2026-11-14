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
  app.get(
    "/api/v1/features",
    wrap(async (req, res) => {
      const s = await tenantContext(req);
      ok(
        res,
        await scoped(
          s.tenant_id,
          async (c) =>
            (
              await c.query(
                "SELECT f.*,COALESCE(tf.enabled,false) tenant_enabled,COALESCE(tf.admin_enabled,true) admin_enabled FROM features f LEFT JOIN tenant_features tf ON tf.feature_key=f.key AND tf.tenant_id=$1 ORDER BY f.name",
                [s.tenant_id],
              )
            ).rows,
        ),
      );
    }),
  );
  app.get(
    "/api/v1/branches",
    wrap(async (req, res) => {
      const s = await tenantContext(req);
      ok(
        res,
        await scoped(
          s.tenant_id,
          async (c) =>
            (
              await c.query(
                "SELECT * FROM branches WHERE tenant_id=$1 AND ($2::uuid IS NULL OR id=$2)",
                [s.tenant_id, s.branch_id],
              )
            ).rows,
        ),
      );
    }),
  );
  const schemas = {
    customers: z.object({
      name: z.string().trim().min(2).max(120),
      email: z.string().email().optional(),
      phone: z.string().max(40).optional(),
      notes: z.string().max(5000).default(""),
      marketing_consent: z.boolean().default(false),
    }),
    services: z.object({
      name: z.string().trim().min(2).max(120),
      duration_minutes: z.number().int().min(5).max(600),
      buffer_minutes: z.number().int().min(0).max(120).default(0),
      price_minor: z.number().int().min(0).max(100000000),
    }),
    employees: z.object({
      name: z.string().trim().min(2).max(120),
      title: z.string().trim().min(1).max(100).default("Stylist"),
      branch_id: z.string().uuid(),
      email: z.string().trim().email().max(254),
      phone: z
        .string()
        .trim()
        .regex(/^[+\d\s().-]{5,40}$/),
      active: z.boolean().default(true),
      commission_basis_points: z.number().int().min(0).max(10000).optional(),
      base_salary_minor: z.number().int().min(0).max(1000000000).optional(),
    }),
  };
  for (const [module, schema] of Object.entries(schemas)) {
    app.get(
      "/api/v1/" + module,
      wrap(async (req, res) => {
        const s = await tenantContext(req, module + ".read");
        await feature(s.tenant_id, module, s.plan);
        const { page, q, contact, consent, sort, status } = z
          .object({
            page: z.coerce.number().int().min(1).default(1),
            q: z.string().max(100).default(""),
            status: z.enum(["all", "active", "inactive"]).default("all"),
            contact: z
              .enum([
                "all",
                "email",
                "phone",
                "missing_email",
                "missing_phone",
                "none",
              ])
              .default("all"),
            consent: z.enum(["all", "yes", "no"]).default("all"),
            sort: z
              .enum(["name_asc", "name_desc", "newest", "oldest"])
              .default("name_asc"),
          })
          .parse(req.query);
        if (module === "customers") {
          const orderBy = {
            name_asc: "name ASC,id ASC",
            name_desc: "name DESC,id DESC",
            newest: "created_at DESC,id DESC",
            oldest: "created_at ASC,id ASC",
          }[sort];
          const result = await scoped(s.tenant_id, async (c) => {
            const values = [s.tenant_id, "%" + q + "%", contact, consent];
            const where =
              "tenant_id=$1 AND deleted_at IS NULL AND NOT is_walk_in AND (name ILIKE $2 OR COALESCE(email,'') ILIKE $2 OR COALESCE(phone,'') ILIKE $2) AND ($3='all' OR ($3='email' AND COALESCE(email,'')<>'') OR ($3='phone' AND COALESCE(phone,'')<>'') OR ($3='missing_email' AND COALESCE(email,'')='') OR ($3='missing_phone' AND COALESCE(phone,'')='') OR ($3='none' AND COALESCE(email,'')='' AND COALESCE(phone,'')='')) AND ($4='all' OR ($4='yes' AND marketing_consent) OR ($4='no' AND NOT marketing_consent))";
            const total = Number(
              (
                await c.query(
                  "SELECT count(*) FROM customers WHERE " + where,
                  values,
                )
              ).rows[0].count,
            );
            const items = (
              await c.query(
                "SELECT * FROM customers WHERE " +
                  where +
                  " ORDER BY " +
                  orderBy +
                  " LIMIT 25 OFFSET $5",
                [...values, (page - 1) * 25],
              )
            ).rows;
            return {
              items,
              total,
              page,
              pageSize: 25,
              hasMore: page * 25 < total,
            };
          });
          return ok(res, result);
        }
        const result = await scoped(s.tenant_id, async (c) => {
          const values = [s.tenant_id, "%" + q + "%", status, s.branch_id];
          const where =
            "tenant_id=$1 AND (name ILIKE $2" +
            (module === "employees"
              ? " OR COALESCE(email,'') ILIKE $2 OR COALESCE(phone,'') ILIKE $2"
              : "") +
            ") AND ($3='all' OR active=($3='active')) AND ($4::uuid IS NULL" +
            (module === "employees"
              ? " OR branch_id=$4)"
              : " OR $4::uuid IS NOT NULL)");
          const total = Number(
            (
              await c.query(
                `SELECT count(*) FROM ${module} WHERE ${where}`,
                values,
              )
            ).rows[0].count,
          );
          const order =
            sort === "name_desc" ? "name DESC,id DESC" : "name ASC,id ASC";
          const items = (
            await c.query(
              (module==='employees'?`SELECT employees.*,(SELECT name FROM branches b WHERE b.tenant_id=employees.tenant_id AND b.id=employees.branch_id) branch_name,(SELECT count(*)::integer FROM employee_schedules es WHERE es.tenant_id=employees.tenant_id AND es.employee_id=employees.id) working_days FROM employees`:`SELECT * FROM ${module}`)+` WHERE ${where} ORDER BY ${order} LIMIT 25 OFFSET $5`,
              [...values, (page - 1) * 25],
            )
          ).rows;
          if (module === "employees")
            for (const employee of items) delete employee.base_salary_minor;
          return {
            items,
            total,
            page,
            pageSize: 25,
            hasMore: page * 25 < total,
          };
        });
        ok(res, result);
      }),
    );
    app.post(
      "/api/v1/" + module,
      wrap(async (req, res) => {
        const s = await tenantContext(req, module + ".write");
        await feature(s.tenant_id, module, s.plan);
        const d = schema.parse(req.body) as Record<string, unknown>;
        if (module === "employees" && "base_salary_minor" in d && !s.is_owner)
          await tenantContext(req, "payroll.write");
        if (
          module === "employees" &&
          "commission_basis_points" in d &&
          !s.is_owner
        )
          throw new HttpError(403, "Only the owner can set commission rates");
        if (
          module === "employees" &&
          s.branch_id &&
          d.branch_id !== s.branch_id
        )
          throw new HttpError(403, "Branch unavailable");
        const fields = Object.keys(d);
        const row = await scoped(s.tenant_id, async (c) => {
          const { rows } = await c.query(
            `INSERT INTO ${module}(tenant_id,${fields.join(",")}) VALUES($1,${fields.map((_, i) => "$" + (i + 2)).join(",")}) RETURNING *`,
            [s.tenant_id, ...Object.values(d)],
          );
          await audit(
            c,
            s.user_id,
            s.tenant_id,
            module + ".created",
            rows[0].id,
          );
          return rows[0];
        });
        ok(res, row, 201);
      }),
    );
  }
  app.get(
    "/api/v1/roles",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "roles.manage");
      ok(res, {
        permissions: permissionKeys,
        roles: await scoped(
          s.tenant_id,
          async (c) =>
            (
              await c.query(
                "SELECT r.*,COALESCE(array_agg(p.permission) FILTER(WHERE p.permission IS NOT NULL),ARRAY[]::text[]) permissions FROM roles r LEFT JOIN role_permissions p ON p.role_id=r.id WHERE r.tenant_id=$1 GROUP BY r.id",
                [s.tenant_id],
              )
            ).rows,
        ),
      });
    }),
  );
  app.post(
    "/api/v1/roles",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "roles.manage");
      if (!s.is_owner)
        throw new HttpError(403, "Only the owner can grant custom permissions");
      const d = z
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
              "INSERT INTO roles(tenant_id,name) VALUES($1,$2) RETURNING *",
              [s.tenant_id, d.name],
            )
          ).rows[0];
          for (const p of new Set(d.permissions))
            await c.query(
              "INSERT INTO role_permissions(role_id,permission) VALUES($1,$2)",
              [r.id, p],
            );
          await audit(c, s.user_id, s.tenant_id, "role.created", r.id);
          return r;
        }),
        201,
      );
    }),
  );
  app.get(
    "/api/v1/audit",
    wrap(async (req, res) => {
      const s = await tenantContext(req, "audit.read");
      ok(
        res,
        (
          await pool.query(
            "SELECT action,target_id,created_at FROM audit_logs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 100",
            [s.tenant_id],
          )
        ).rows,
      );
    }),
  );
}
