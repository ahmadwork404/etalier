import type express from "express";
import { z } from "zod";
import swaggerUi from "swagger-ui-express";
import { session, wrap } from "./runtime.js";
import { credentials } from "./runtime.js";
const uuid = z.string().uuid();
const requests: Record<string, z.ZodType> = {
  "POST /api/v1/auth/register": credentials.extend({
    name: z.string().min(2).max(100),
  }),
  "POST /api/v1/auth/login": credentials,
  "POST /api/v1/tenants": z.object({
    name: z.string().min(2).max(100),
    slug: z.string().min(3).max(63),
  }),
  "POST /api/v1/appointments": z.object({
    branch_id: uuid,
    customer_id: uuid,
    employee_id: uuid,
    service_ids: z.array(uuid).min(1).max(10),
    starts_at: z.string().datetime({ offset: true }),
    notes: z.string().max(5000).optional(),
  }),
  "PATCH /api/v1/appointments/:id": z.object({
    status: z
      .enum([
        "confirmed",
        "checked_in",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
      ])
      .optional(),
    starts_at: z.string().datetime({ offset: true }).optional(),
  }),
  "POST /api/v1/orders": z.object({
    branch_id: uuid,
    customer_id: uuid,
    appointment_id: uuid.optional(),
    items: z.array(
      z.object({
        kind: z.enum(["service", "product"]),
        id: uuid,
        quantity: z.number().int().min(1).max(100),
      }),
    ),
    discount_minor: z.number().int().min(0).optional(),
    idempotency_key: z.string().min(8).max(100),
  }),
  "POST /api/v1/orders/:id/payments": z.object({
    amount_minor: z.number().int().positive(),
    method: z.enum(["cash", "card", "bank_transfer"]),
    idempotency_key: z.string().min(8).max(100),
  }),
  "POST /api/v1/inventory/movements": z.object({
    branch_id: uuid,
    product_id: uuid,
    quantity: z.number(),
    reason: z.enum(["purchase", "adjustment", "damaged", "expired", "return"]),
    transfer_to: uuid.optional(),
  }),
};
export function captureRoutes(app: express.Express) {
  const routes: { path: string; method: string }[] = [];
  for (const method of ["get", "post", "patch", "delete", "put"] as const) {
    const original = (app[method] as any).bind(app);
    (app as any)[method] = (path: any, ...handlers: any[]) => {
      if (typeof path === "string" && path.startsWith("/api/v1/"))
        routes.push({ path, method });
      return original(path, ...handlers);
    };
  }
  return routes;
}
export function mountDocs(
  app: express.Express,
  routes: { path: string; method: string }[],
) {
  const paths: any = {};
  for (const route of routes) {
    const path = route.path.replace(/:([a-zA-Z_]+)/g, "{$1}");
    const parameters = [...route.path.matchAll(/:([a-zA-Z_]+)/g)].map((m) => ({
      name: m[1],
      in: "path",
      required: true,
      schema: { type: "string" },
    }));
    if (route.method === "get")
      parameters.push(
        ...["page", "q", "from", "to", "branch_id", "employee_id"].map(
          (name) => ({
            name,
            in: "query",
            required: false,
            schema: { type: "string" },
          }),
        ),
      );
    const publicRoute =
      /\/auth\/(register|login|request-reset|reset|verify)$|\/booking\/|\/customer-link\/|\/health$|\/webhooks\//.test(
        route.path,
      );
    const request = requests[route.method.toUpperCase() + " " + route.path];
    paths[path] ??= {};
    paths[path][route.method] = {
      summary: route.method.toUpperCase() + " " + route.path,
      tags: [route.path.split("/")[3]],
      description: publicRoute
        ? "Public or secure-link endpoint. Link tokens are purpose-scoped and time-limited."
        : "Authenticated endpoint. The server validates tenant membership, granular permission, feature availability, plan and applicable branch scope.",
      security: publicRoute ? [] : [{ cookieSession: [] }],
      parameters,
      ...(request
        ? {
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: z.toJSONSchema(request, { io: "input" }),
                },
              },
            },
          }
        : {}),
      responses: {
        "200": {
          description: "Successful operation",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { data: {} },
                required: ["data"],
              },
            },
          },
        },
        "201": { description: "Resource created" },
        "401": { description: "Session required or expired" },
        "403": { description: "Permission, feature or tenant access denied" },
        "404": { description: "Record unavailable" },
        "409": {
          description:
            "Conflict, insufficient balance, or idempotency mismatch",
        },
        "422": { description: "Input validation failed" },
        "429": { description: "Rate limit reached" },
        "503": { description: "External integration not configured" },
      },
    };
  }
  const document = {
    openapi: "3.1.0",
    info: {
      title: "Atelier Business API",
      version: "0.2.0",
      description:
        "Live route catalogue generated from registered Express endpoints. Request schemas are provided for core booking, checkout and authentication operations; full schema coverage is still tracked in the production checklist.",
    },
    servers: [{ url: "/" }],
    components: {
      securitySchemes: {
        cookieSession: {
          type: "apiKey",
          in: "cookie",
          name: "atelier_session",
        },
      },
    },
    paths,
  };
  app.get(
    "/api/v1/openapi.json",
    wrap(async (req, res) => {
      await session(req);
      res.json(document);
    }),
  );
  app.use(
    "/api/v1/docs",
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      session(req)
        .then(() => next())
        .catch(next);
    },
    swaggerUi.serve,
    swaggerUi.setup(document),
  );
}
