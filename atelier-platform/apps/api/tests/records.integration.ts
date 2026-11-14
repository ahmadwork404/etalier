import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../src/db.js";

test("record actions validate edits, protect linked history, enforce scope and audit deletes", async () => {
  let cookie = "",
    tenant = "",
    user = "";
  async function call(
    path: string,
    method = "GET",
    body?: unknown,
    expected = 200,
  ) {
    const response = await fetch(
      (process.env.ATELIER_TEST_API_URL || "http://127.0.0.1:4000/api/v1/") +
        path,
      {
        method,
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
          cookie,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
    );
    const next = response.headers.get("set-cookie");
    if (next) cookie = next.split(";")[0];
    const payload = (await response.json()) as any;
    assert.equal(
      response.status,
      expected,
      `${method} ${path}: ${JSON.stringify(payload.error)}`,
    );
    return payload.data;
  }
  const record = (kind: string, id: string) => `records/${kind}/${id}`;
  try {
    const credentials = {
      email: randomUUID() + "@example.test",
      password: "QA-" + randomUUID(),
      name: "QA record owner",
    };
    user = (await call("auth/register", "POST", credentials, 201)).id;
    await call("auth/login", "POST", credentials);
    tenant = (
      await call(
        "tenants",
        "POST",
        { name: "QA record salon", slug: "qa-" + randomUUID() },
        201,
      )
    ).id;
    const branch = (await call("branches"))[0].id;
    const employee = (
      await call(
        "employees",
        "POST",
        { name: "Test employee", branch_id: branch },
        201,
      )
    ).id;
    const service = (
      await call(
        "services",
        "POST",
        { name: "Test service", duration_minutes: 30, price_minor: 2000 },
        201,
      )
    ).id;
    const supplier = (
      await call(
        "suppliers",
        "POST",
        { name: "Test supplier", email: "supplier@example.test" },
        201,
      )
    ).id;
    const product = (
      await call(
        "products",
        "POST",
        {
          name: "Test product",
          sku: randomUUID(),
          supplier_id: supplier,
          price_minor: 1000,
          cost_minor: 500,
        },
        201,
      )
    ).id;
    const customer = (
      await call("customers", "POST", { name: "Test customer" }, 201)
    ).id;
    const schedule = (
      await call(
        "employee-schedules",
        "POST",
        {
          employee_id: employee,
          weekday: 1,
          opens_at: "09:00",
          closes_at: "18:00",
        },
        201,
      )
    ).id;
    const leave = (
      await call(
        "employee-leaves",
        "POST",
        {
          employee_id: employee,
          starts_at: "2030-01-01T09:00:00Z",
          ends_at: "2030-01-01T18:00:00Z",
          reason: "Holiday",
        },
        201,
      )
    ).id;
    const expense = (
      await call(
        "expenses",
        "POST",
        {
          branch_id: branch,
          name: "Test expense",
          amount_minor: 500,
          incurred_on: "2026-11-12",
        },
        201,
      )
    ).id;
    const payroll = (
      await call(
        "payroll",
        "POST",
        {
          employee_id: employee,
          period_start: "2026-11-01",
          period_end: "2026-11-30",
          base_minor: 10000,
        },
        201,
      )
    ).id;
    const editable: [string, string, Record<string, unknown>][] = [
      [
        "branches",
        branch,
        { name: "Updated workspace", address: "QA address" },
      ],
      ["employees", employee, { name: "Updated employee", active: false }],
      ["services", service, { price_minor: 2500, buffer_minutes: 10 }],
      ["suppliers", supplier, { phone: "+1 202-555-0100" }],
      ["products", product, { minimum_stock: 10, expires_on: null }],
      ["expenses", expense, { amount_minor: 600 }],
      [
        "employee-schedules",
        schedule,
        { opens_at: "10:00", closes_at: "19:00" },
      ],
      ["employee-leaves", leave, { reason: "Updated holiday" }],
      ["payroll", payroll, { bonus_minor: 1000 }],
    ];
    for (const [kind, id, changes] of editable) {
      await call(record(kind, id));
      await call(record(kind, id), "PATCH", changes);
      const saved = await call(record(kind, id));
      for (const [key, value] of Object.entries(changes))
        assert.equal(
          ["opens_at", "closes_at"].includes(key)
            ? String(saved[key]).slice(0, 5)
            : typeof value === "number"
              ? String(Number(saved[key]))
              : String(saved[key]),
          String(value),
          `${kind}.${key}`,
        );
    }
    await call(
      record("products", product),
      "PATCH",
      { tenant_id: randomUUID() },
      422,
    );
    await call(record("products", product), "PATCH", { price_minor: -1 }, 422);
    await call(
      record("employee-schedules", schedule),
      "PATCH",
      { opens_at: "21:00", closes_at: "09:00" },
      422,
    );
    await call(
      record("employee-leaves", leave),
      "PATCH",
      { ends_at: "2029-12-31T00:00:00Z" },
      422,
    );
    await call(
      record("payroll", payroll),
      "PATCH",
      { deduction_minor: 999999 },
      422,
    );
    await call(
      record("payroll", payroll),
      "PATCH",
      { period_end: "2026-10-31" },
      422,
    );
    await call(record("suppliers", supplier), "DELETE", undefined, 409);
    await call(record("branches", branch), "DELETE", undefined, 409);
    await call(
      "service-consumables",
      "POST",
      { service_id: service, product_id: product, quantity: 1 },
      201,
    );
    const ruleId = service + "." + product;
    assert.equal(
      Number(
        (
          await call(record("service-consumables", ruleId), "PATCH", {
            quantity: 2,
          })
        ).quantity,
      ),
      2,
    );
    await call(record("service-consumables", ruleId), "DELETE");
    await call("payroll/" + payroll, "PATCH", {});
    await call(record("payroll", payroll), "PATCH", { base_minor: 1 }, 409);
    await call(record("payroll", payroll), "DELETE", undefined, 409);
    const role = (
      await pool.query(
        "INSERT INTO roles(tenant_id,name) VALUES($1,'QA reader') RETURNING id",
        [tenant],
      )
    ).rows[0].id;
    // An unrelated/missing id must never reveal a different tenant's record.
    await call(record("products", randomUUID()), "GET", undefined, 404);
    await pool.query(
      "UPDATE memberships SET role_id=$1 WHERE tenant_id=$2 AND user_id=$3",
      [role, tenant, user],
    );
    await call(
      record("products", product),
      "PATCH",
      { name: "Forbidden" },
      403,
    );
    await call(record("products", product), "DELETE", undefined, 403);
    await pool.query(
      "UPDATE memberships SET role_id=(SELECT id FROM roles WHERE tenant_id=$1 AND is_owner) WHERE tenant_id=$1 AND user_id=$2",
      [tenant, user],
    );
    for (const [kind, id] of [
      ["expenses", expense],
      ["products", product],
      ["suppliers", supplier],
      ["employee-leaves", leave],
      ["employee-schedules", schedule],
      ["services", service],
      ["customers", customer],
    ]) {
      await call(record(kind, id), "DELETE");
      await call(record(kind, id), "GET", undefined, 404);
    }
    const logs = (
      await pool.query(
        "SELECT action FROM audit_logs WHERE tenant_id=$1 AND action LIKE '%.deleted'",
        [tenant],
      )
    ).rows;
    assert.ok(logs.length >= 8);
    assert.equal((await call("customers")).total, 0);
  } finally {
    if (tenant) {
      for (const table of [
        "payroll_records",
        "employee_leaves",
        "employee_schedules",
        "service_consumables",
        "products",
        "suppliers",
        "expenses",
        "services",
        "employees",
        "consent_records",
        "customers",
        "audit_logs",
        "tenant_features",
        "memberships",
        "branches",
      ])
        await pool.query(`DELETE FROM ${table} WHERE tenant_id=$1`, [tenant]);
      await pool.query(
        "DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE tenant_id=$1)",
        [tenant],
      );
      await pool.query("DELETE FROM roles WHERE tenant_id=$1", [tenant]);
      await pool.query(
        "UPDATE sessions SET tenant_id=NULL WHERE tenant_id=$1",
        [tenant],
      );
      await pool.query("DELETE FROM tenants WHERE id=$1", [tenant]);
    }
    if (user) {
      await pool.query("DELETE FROM audit_logs WHERE actor_id=$1", [user]);
      await pool.query("DELETE FROM sessions WHERE user_id=$1", [user]);
      await pool.query("DELETE FROM users WHERE id=$1", [user]);
    }
    await pool.end();
  }
});
