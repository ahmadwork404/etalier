import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import passwords from "./services/passwords.js";
import { isIP } from "node:net";
import { z } from "zod";
import { pool, transaction, scoped, audit } from "./db.js";
import {
  digest,
  newToken,
  HttpError,
  permissionKeys,
  featureAllowed,
} from "./security.js";
const app = express();
app.use((req,_res,next)=>{
  if(process.env.CLOUDFLARE_WORKER === "1"){
    const raw=String(req.headers["x-etalier-client-ip"]||"");
    Object.defineProperty(req,"ip",{value:isIP(raw)?raw:"0.0.0.0",configurable:true});
    delete req.headers["x-forwarded-for"];
  }
  next();
});
import { allowedOrigins } from "./services/public-urls.js";
const origins = allowedOrigins();
app.use(
  helmet(),
  cors({
    origin: (origin, callback) =>
      callback(null, !!origin && origins.has(origin)),
    credentials: true,
  }),
  express.json({
    limit: "100kb",
    verify: (req, _res, buffer) => {
      if (req.url === "/api/v1/webhooks/stripe") (req as any).rawBody = buffer;
    },
  }),
  cookieParser(),
);
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 180,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    !origins.has(req.headers.origin || "") &&
    req.path !== "/api/v1/webhooks/stripe"
  )
    return next(new HttpError(403, "Invalid request origin"));
  next();
});
const authLimit = rateLimit({
  windowMs: 15 * 60000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({
      error: {
        message:
          "Too many attempts. Please wait a few minutes before trying again.",
      },
    }),
});
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api",
  maxAge: 7 * 86400000,
};
const wrap =
  (fn: (req: Request, res: Response) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
const ok = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ data });
const credentials = z.object({
  email: z
    .string()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(12).max(128),
});
async function session(req: Request) {
  const token = req.cookies.atelier_session;
  if (!token) throw new HttpError(401, "Sign in to continue");
  const { rows } = await pool.query(
    "SELECT s.id session_id,s.tenant_id,u.id user_id,u.name,u.email,u.platform_role,u.email_verified_at,t.currency,t.timezone FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN tenants t ON t.id=s.tenant_id WHERE s.token_hash=$1 AND s.expires_at>now() AND NOT u.suspended",
    [digest(token)],
  );
  if (!rows[0]) throw new HttpError(401, "Session expired");
  if (rows[0].platform_role) rows[0].tenant_id = null;
  if (
    process.env.NODE_ENV === "production" &&
    !rows[0].email_verified_at &&
    !req.path.startsWith("/api/v1/auth/")
  )
    throw new HttpError(403, "Verify your email address before continuing");
  return rows[0];
}
async function tenantContext(req: Request, permission?: string) {
  const s = await session(req);
  if (s.platform_role)
    throw new HttpError(403, "Platform accounts cannot access shop operations");
  if (!s.tenant_id) throw new HttpError(403, "Choose a workspace first");
  return scoped(s.tenant_id, async (c) => {
    const { rows } = await c.query(
      "SELECT m.*,r.is_owner,t.plan,t.status,t.max_locations FROM memberships m JOIN roles r ON r.id=m.role_id AND r.tenant_id=m.tenant_id JOIN tenants t ON t.id=m.tenant_id WHERE m.tenant_id=$1 AND m.user_id=$2 AND m.active",
      [s.tenant_id, s.user_id],
    );
    const m = rows[0];
    if (!m || m.status !== "active")
      throw new HttpError(403, "Workspace unavailable");
    if (
      permission &&
      !m.is_owner &&
      !(
        await c.query(
          "SELECT 1 FROM role_permissions WHERE role_id=$1 AND permission=$2",
          [m.role_id, permission],
        )
      ).rowCount
    )
      throw new HttpError(403, "Permission denied");
    return {
      ...s,
      branch_id: m.branch_id,
      is_owner: m.is_owner,
      plan: m.plan,
      max_locations: m.max_locations,
    };
  });
}
async function feature(tenant: string, key: string, plan: string) {
  return scoped(tenant, async (c) => {
    const { rows } = await c.query(
      "SELECT f.*,COALESCE(tf.enabled,false) tenant_enabled,COALESCE(tf.admin_enabled,true) admin_enabled FROM features f LEFT JOIN tenant_features tf ON tf.feature_key=f.key AND tf.tenant_id=$1",
      [tenant],
    );
    const enabled = (k: string, seen = new Set<string>()): boolean => {
      if (seen.has(k)) return false;
      seen.add(k);
      const f = rows.find((r) => r.key === k);
      return (
        !!f &&
        featureAllowed(
          f,
          f.tenant_enabled && f.admin_enabled !== false,
          plan,
          !f.dependency || enabled(f.dependency, seen),
        )
      );
    };
    if (!enabled(key))
      throw new HttpError(
        403,
        "This feature is disabled or unavailable on your plan",
      );
  });
}
async function platform(req: Request) {
  const s = await session(req);
  if (s.platform_role !== "super_admin")
    throw new HttpError(403, "Platform administrator access required");
  return s;
}

export {
  app,
  wrap,
  ok,
  authLimit,
  cookieOptions,
  credentials,
  session,
  tenantContext,
  feature,
  platform,
};
