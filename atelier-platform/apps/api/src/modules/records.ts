import type express from "express";
import { z } from "zod";
import { scoped, audit } from "../db.js";
import { wrap, ok, tenantContext, feature } from "../runtime.js";
import { HttpError } from "../security.js";
import { sameBranch } from "../services/inventory.js";
import { canViewEmployeeSalary } from "../services/employee-access.js";

const uuid = z.string().uuid();
const name = z.string().trim().min(2).max(120);
const money = z.number().int().min(0).max(1000000000);
const optionalEmail = z.union([z.string().email(), z.literal("")]).nullable();
type RecordDefinition = {
  table: string;
  read: string;
  write: string;
  feature?: string;
  employee?: boolean;
  schema: z.ZodObject<any>;
  readOnly?: boolean;
};
// Table and field names are exclusively selected from this server-owned registry.
const definitions: Record<string, RecordDefinition> = {
  orders: {
    table: "orders",
    read: "finance.read",
    write: "finance.write",
    feature: "sales_management",
    readOnly: true,
    schema: z.object({}),
  },
  "service-consumables": {
    table: "service_consumables",
    read: "inventory.read",
    write: "inventory.write",
    feature: "inventory",
    schema: z.object({ quantity: z.number().positive().max(100000) }),
  },
  forms: {
    table: "forms",
    read: "forms.read",
    write: "forms.write",
    feature: "forms",
    schema: z.object({ name, active: z.boolean() }),
  },
  workflows: {
    table: "workflows",
    read: "marketing.read",
    write: "marketing.write",
    feature: "automations",
    schema: z.object({
      name,
      subject: z.string().min(1).max(200),
      body: z.string().min(1).max(5000),
      delay_minutes: z.number().int().min(0).max(525600),
    }),
  },
  campaigns: {
    table: "campaigns",
    read: "marketing.read",
    write: "marketing.write",
    feature: "marketing",
    schema: z.object({
      name,
      subject: z.string().min(1).max(200),
      body: z.string().min(1).max(5000),
    }),
  },
  "membership-plans": {
    table: "membership_plans",
    read: "marketing.read",
    write: "marketing.write",
    feature: "memberships",
    schema: z.object({
      name,
      price_minor: money,
      duration_days: z.number().int().min(1).max(3660),
      service_credits: z.number().int().min(0).max(10000),
    }),
  },
  branches: {
    table: "branches",
    read: "settings.manage",
    write: "settings.manage",
    schema: z.object({ name, address: z.string().max(1000) }),
  },
  customers: {
    table: "customers",
    read: "customers.read",
    write: "customers.write",
    feature: "customers",
    schema: z.object({ name, email: optionalEmail, phone: z.string().max(40) }),
  },
  employees: {
    table: "employees",
    read: "employees.read",
    write: "employees.write",
    feature: "employees",
    schema: z.object({
      name,
      title: z.string().max(100),
      email: z.string().trim().email().max(254),
      phone: z
        .string()
        .trim()
        .regex(/^[+\d\s().-]{5,40}$/),
      active: z.boolean(),
      base_salary_minor: z.number().int().min(0).max(1000000000),
    }),
  },
  services: {
    table: "services",
    read: "services.read",
    write: "services.write",
    feature: "services",
    schema: z.object({
      name,
      price_minor: money,
      duration_minutes: z.number().int().min(5).max(600),
      buffer_minutes: z.number().int().min(0).max(120),
      active: z.boolean(),
    }),
  },
  products: {
    table: "products",
    read: "inventory.read",
    write: "inventory.write",
    feature: "inventory",
    schema: z.object({
      name,
      sku: z.string().trim().min(1).max(80),
      price_minor: money,
      cost_minor: money,
      minimum_stock: z.number().min(0).max(100000),
      supplier_id: uuid.nullable(),
      expires_on: z.string().date().nullable(),
      active: z.boolean(),
    }),
  },
  suppliers: {
    table: "suppliers",
    read: "inventory.read",
    write: "inventory.write",
    feature: "inventory",
    schema: z.object({ name, email: optionalEmail, phone: z.string().max(40) }),
  },
  expenses: {
    table: "expenses",
    read: "finance.read",
    write: "finance.write",
    feature: "sales_management",
    schema: z.object({
      name: name.max(200),
      amount_minor: money.refine((value) => value > 0),
      incurred_on: z.string().date(),
    }),
  },
  "employee-schedules": {
    table: "employee_schedules",
    read: "employees.read",
    write: "employees.write",
    feature: "employees",
    employee: true,
    schema: z.object({
      weekday: z.number().int().min(0).max(6),
      opens_at: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
      closes_at: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    }),
  },
  "employee-leaves": {
    table: "employee_leaves",
    read: "employees.read",
    write: "employees.write",
    feature: "employees",
    employee: true,
    schema: z.object({
      starts_at: z.string().datetime({ offset: true }),
      ends_at: z.string().datetime({ offset: true }),
      reason: z.string().max(1000),
      paid: z.boolean(),
    }),
  },
  payroll: {
    table: "payroll_records",
    read: "payroll.read",
    write: "payroll.write",
    feature: "employees",
    employee: true,
    schema: z.object({
      period_start: z.string().date(),
      period_end: z.string().date(),
      base_minor: money,
      bonus_minor: money,
      deduction_minor: money,
    }),
  },
};

export function register(app: express.Express) {
  for (const method of ["get", "patch", "delete"] as const) {
    app[method](
      "/api/v1/records/:kind/:id",
      wrap(async (req, res) => {
        if (req.params.kind === "payroll" && method === "patch")
          throw new HttpError(
            422,
            "Use the payroll detail screen to adjust this draft.",
          );
        const kind = String(req.params.kind),
          definition = definitions[kind];
        if (!definition) throw new HttpError(404, "Record type not found");
        const session = await tenantContext(
          req,
          method === "get" ? definition.read : definition.write,
        );
        if (definition.feature)
          await feature(session.tenant_id, definition.feature, session.plan);
        const salaryVisible =
          kind === "employees" &&
          (await canViewEmployeeSalary(req, session.is_owner));
        if (
          kind === "employees" &&
          method === "patch" &&
          Object.prototype.hasOwnProperty.call(
            req.body || {},
            "base_salary_minor",
          ) &&
          !session.is_owner
        )
          await tenantContext(req, "payroll.write");
        const composite = kind === "service-consumables";
        const identifiers = composite
          ? z.tuple([uuid, uuid]).parse(String(req.params.id).split("."))
          : [uuid.parse(req.params.id)];
        const id = identifiers.join(".");
        const parameters = [session.tenant_id, ...identifiers];
        const where = composite
          ? "tenant_id=$1 AND service_id=$2 AND product_id=$3"
          : "tenant_id=$1 AND id=$2";
        const result = await scoped(session.tenant_id, async (client) => {
          if (kind === "branches" && method !== "get") {
            if (session.branch_id)
              throw new HttpError(403, "Organization-wide access required");
            await client.query(
              "SELECT id FROM tenants WHERE id=$1 FOR UPDATE",
              [session.tenant_id],
            );
          }
          const record = (
            await client.query(
              `SELECT * FROM ${definition.table} WHERE ${where}${kind === "customers" ? " AND deleted_at IS NULL" : ""} FOR UPDATE`,
              parameters,
            )
          ).rows[0];
          if (!record) throw new HttpError(404, "Record not found");
          if (record.branch_id) sameBranch(session, record.branch_id);
          if (kind === "branches") sameBranch(session, record.id);
          if (definition.employee) {
            const employee = (
              await client.query(
                "SELECT branch_id FROM employees WHERE tenant_id=$1 AND id=$2",
                [session.tenant_id, record.employee_id],
              )
            ).rows[0];
            if (!employee) throw new HttpError(404, "Employee not found");
            sameBranch(session, employee.branch_id);
          }
          if (method === "get") {
            if (kind === "employees" && !salaryVisible)
              delete record.base_salary_minor;
            if (kind === "orders") {
              record.items = (
                await client.query(
                  "SELECT name,quantity,price_minor FROM order_items WHERE tenant_id=$1 AND order_id=$2",
                  [session.tenant_id, id],
                )
              ).rows;
              record.payments = (
                await client.query(
                  "SELECT method,amount_minor,created_at FROM payments WHERE tenant_id=$1 AND order_id=$2 ORDER BY created_at DESC",
                  [session.tenant_id, id],
                )
              ).rows;
            }
            return record;
          }
          if (definition.readOnly)
            throw new HttpError(
              409,
              "Financial history is retained. Use the payment or refund actions to make a correction.",
            );
          if (kind === "campaigns" && record.status !== "draft")
            throw new HttpError(
              409,
              "Only draft campaigns can be edited or deleted. Use Pause to stop a queued campaign.",
            );
          if (kind === "workflows" && record.enabled)
            throw new HttpError(
              409,
              "Pause this automation before editing or deleting it.",
            );
          if (kind === "payroll" && record.status !== "draft")
            throw new HttpError(
              409,
              "Paid payroll is retained for your financial history. Only drafts can be changed or deleted.",
            );
          if (method === "delete") {
            if (
              kind === "branches" &&
              Number(
                (
                  await client.query(
                    "SELECT count(*) FROM branches WHERE tenant_id=$1",
                    [session.tenant_id],
                  )
                ).rows[0].count,
              ) <= 1
            )
              throw new HttpError(
                409,
                "Keep at least one workspace in your salon.",
              );
            if (kind === "customers") {
              if (
                (
                  await client.query(
                    "SELECT 1 FROM appointments WHERE tenant_id=$1 AND customer_id=$2 AND starts_at>=now() AND status NOT IN ('completed','cancelled','no_show','rescheduled') LIMIT 1",
                    [session.tenant_id, id],
                  )
                ).rowCount
              )
                throw new HttpError(
                  409,
                  "Cancel or complete this customer's upcoming appointments before deleting them.",
                );
              await client.query(
                "UPDATE customers SET deleted_at=now(),updated_at=now() WHERE tenant_id=$1 AND id=$2",
                [session.tenant_id, id],
              );
            } else
              await client.query(
                `DELETE FROM ${definition.table} WHERE ${where}`,
                parameters,
              );
            await audit(
              client,
              session.user_id,
              session.tenant_id,
              kind + ".deleted",
              id,
            );
            return { deleted: true };
          }
          const changes = definition.schema
            .partial()
            .strict()
            .parse(req.body) as Record<string, unknown>;
          if (!Object.keys(changes).length)
            throw new HttpError(422, "No changes provided");
          const next = { ...record, ...changes };
          if (kind === "employee-schedules" && next.closes_at <= next.opens_at)
            throw new HttpError(
              422,
              "Closing time must be after opening time.",
            );
          if (
            kind === "employee-leaves" &&
            new Date(next.ends_at) <= new Date(next.starts_at)
          )
            throw new HttpError(422, "Leave must end after it starts.");
          if (
            kind === "employee-leaves" &&
            ("starts_at" in changes || "ends_at" in changes)
          ) {
            if (
              (
                await client.query(
                  "SELECT 1 FROM appointments WHERE tenant_id=$1 AND employee_id=$2 AND starts_at<$4 AND ends_at>$3 AND status NOT IN ('cancelled','no_show','rescheduled') LIMIT 1",
                  [
                    session.tenant_id,
                    record.employee_id,
                    next.starts_at,
                    next.ends_at,
                  ],
                )
              ).rowCount
            )
              throw new HttpError(
                409,
                "This leave overlaps an appointment. Reschedule the appointment first.",
              );
          }
          if (
            kind === "payroll" &&
            (new Date(next.period_end).getTime() <
              new Date(next.period_start).getTime() ||
              Number(next.deduction_minor) >
                Number(next.base_minor) + Number(next.bonus_minor))
          )
            throw new HttpError(422, "Check the payroll dates and deductions.");
          const keys = Object.keys(changes);
          const updated = (
            await client.query(
              `UPDATE ${definition.table} SET ${keys.map((key, index) => key + "=$" + (index + parameters.length + 1)).join(",")} WHERE ${where} RETURNING *`,
              [...parameters, ...Object.values(changes)],
            )
          ).rows[0];
          await audit(
            client,
            session.user_id,
            session.tenant_id,
            kind + ".updated",
            id,
          );
          if (kind === "employees" && !salaryVisible)
            delete updated.base_salary_minor;
          return updated;
        }).catch((error) => {
          if (error.code === "23503")
            throw new HttpError(
              409,
              "This record is used elsewhere in your salon. Remove its links first, or mark it inactive to keep its history.",
            );
          throw error;
        });
        ok(res, result);
      }),
    );
  }
}
