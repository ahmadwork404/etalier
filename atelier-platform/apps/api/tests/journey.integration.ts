import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../src/db.js";
test("real salon journey: schedule, race rejection, consumption, POS idempotency, refunds, forms and audit", async () => {
  let cookie = "",
    tenant = "",
    user = "";
  async function call(path: string, method = "GET", body?: unknown) {
    const r = await fetch(
      (process.env.ATELIER_TEST_API_URL || "http://127.0.0.1:4000/api/v1/") +
        path,
      {
        method,
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
          cookie,
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    const set = r.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const payload = (await r.json()) as any;
    return { status: r.status, data: payload.data, error: payload.error };
  }
  async function good(
    path: string,
    method = "GET",
    body?: unknown,
    status = 200,
  ) {
    const r = await call(path, method, body);
    assert.equal(r.status, status, JSON.stringify(r.error));
    return r.data;
  }
  try {
    const email = "journey-" + randomUUID() + "@example.test",
      password = "QA-" + randomUUID();
    user = (
      await good(
        "auth/register",
        "POST",
        { email, password, name: "QA journey" },
        201,
      )
    ).id;
    await good("auth/login", "POST", { email, password });
    tenant = (
      await good(
        "tenants",
        "POST",
        { name: "QA journey salon", slug: "qa-" + randomUUID() },
        201,
      )
    ).id;
    const branch = (await good("branches"))[0].id;
    const employee = (
      await good(
        "employees",
        "POST",
        { name: "QA stylist", branch_id: branch },
        201,
      )
    ).id;
    const customer = (
      await good("customers", "POST", { name: "QA customer" }, 201)
    ).id;
    const service = (
      await good(
        "services",
        "POST",
        { name: "QA haircut", duration_minutes: 45, price_minor: 350000 },
        201,
      )
    ).id;
    const product = (
      await good(
        "products",
        "POST",
        {
          name: "QA shampoo",
          sku: randomUUID(),
          price_minor: 100000,
          cost_minor: 50000,
          minimum_stock: 2,
        },
        201,
      )
    ).id;
    for (let weekday = 0; weekday < 7; weekday++)
      await good(
        "employee-schedules",
        "POST",
        {
          employee_id: employee,
          weekday,
          opens_at: "08:00",
          closes_at: "20:00",
        },
        201,
      );
    await good(
      "inventory/movements",
      "POST",
      {
        branch_id: branch,
        product_id: product,
        quantity: 20,
        reason: "purchase",
      },
      201,
    );
    await good(
      "service-consumables",
      "POST",
      { service_id: service, product_id: product, quantity: 2 },
      201,
    );
    const tomorrow = new Date(Date.now() + 86400000);
    tomorrow.setUTCHours(6, 0, 0, 0);
    const booking = {
      branch_id: branch,
      employee_id: employee,
      customer_id: customer,
      service_ids: [service],
      starts_at: tomorrow.toISOString(),
    };
    const race = await Promise.all([
      call("appointments", "POST", booking),
      call("appointments", "POST", booking),
    ]);
    assert.deepEqual(race.map((r) => r.status).sort(), [201, 409]);
    const appointment = race.find((r) => r.status === 201)!.data;
    await good("appointments/" + appointment.id, "PATCH", {
      status: "completed",
    });
    assert.equal(Number((await good("inventory"))[0].quantity), 18);
    assert.equal(
      (
        await call("appointments/" + appointment.id, "PATCH", {
          status: "completed",
        })
      ).status,
      409,
    );
    const order = await good(
      "orders",
      "POST",
      {
        branch_id: branch,
        customer_id: customer,
        appointment_id: appointment.id,
        items: [{ kind: "product", id: product, quantity: 1 }],
        idempotency_key: randomUUID(),
      },
      201,
    );
    assert.equal(Number(order.total_minor), 450000);
    assert.equal(Number((await good("inventory"))[0].quantity), 17);
    const key = randomUUID();
    const first = await good(
      "orders/" + order.id + "/payments",
      "POST",
      { amount_minor: 200000, method: "cash", idempotency_key: key },
      201,
    );
    const again = await good(
      "orders/" + order.id + "/payments",
      "POST",
      { amount_minor: 200000, method: "cash", idempotency_key: key },
      201,
    );
    assert.equal(first.id, again.id);
    await good(
      "orders/" + order.id + "/payments",
      "POST",
      {
        amount_minor: 250000,
        method: "bank_transfer",
        idempotency_key: randomUUID(),
      },
      201,
    );
    assert.equal(
      (
        await call("orders/" + order.id + "/payments", "POST", {
          amount_minor: 1,
          method: "cash",
          idempotency_key: randomUUID(),
        })
      ).status,
      409,
    );
    await good(
      "payments/" + first.id + "/refunds",
      "POST",
      {
        amount_minor: 50000,
        reason: "QA refund",
        idempotency_key: randomUUID(),
      },
      201,
    );
    assert.equal(
      (
        await call("payments/" + first.id + "/refunds", "POST", {
          amount_minor: 200000,
          reason: "QA exceeds",
          idempotency_key: randomUUID(),
        })
      ).status,
      409,
    );
    const form = await good(
      "forms",
      "POST",
      {
        name: "QA consent",
        fields: [
          { key: "consent", label: "Consent", type: "consent", required: true },
        ],
      },
      201,
    );
    const link = await good(
      "customer-links",
      "POST",
      { customer_id: customer, purpose: "form", resource_id: form.id },
      201,
    );
    const token = new URL(link.url).searchParams.get("token");
    assert.equal(
      (
        await call("customer-link/" + token, "POST", {
          answers: { consent: false },
        })
      ).status,
      422,
    );
    await good("customer-link/" + token, "POST", {
      answers: { consent: true },
    });
    assert.equal(
      (
        await call("customer-link/" + token, "POST", {
          answers: { consent: true },
        })
      ).status,
      403,
    );
    const analytics = await good("analytics?from=2020-01-01&to=2040-01-01");
    assert.equal(analytics.net_minor, 400000);
    const profile = await good("customers/" + customer);
    assert.equal(profile.customer.id, customer);
    const invoices = await good(`customers/${customer}/invoices`);
    assert.equal(invoices.total, 1);
    assert.equal(invoices.items[0].id, order.id);
    const insights = await good(`customers/${customer}/insights`);
    assert.equal(insights.attendance.completed, 1);
    assert.equal(insights.financial.net_collected_minor, 400000);
    assert.equal(insights.financial.known_cost_minor, 150000);
    assert.equal(insights.financial.contribution_minor, 250000);
    assert.equal(insights.financial.monthly.length, 6);
    assert.equal(
      insights.financial.monthly.reduce(
        (sum: number, month: any) => sum + month.net_minor,
        0,
      ),
      400000,
    );
    assert.equal(Number(invoices.items[0].refunded_minor), 50000);
    const past = await good(`customers/${customer}/appointments?section=past`);
    assert.equal(past.total, 1);
    assert.equal(past.items[0].id, appointment.id);
    assert.equal(
      (await good(`customers/${customer}/appointments?section=upcoming`)).total,
      0,
    );
    assert.ok((await good("audit")).length > 10);
    const payroll = await good(
      "payroll",
      "POST",
      {
        employee_id: employee,
        period_start: "2030-01-01",
        period_end: "2030-01-31",
        base_minor: 5000000,
      },
      201,
    );
    await good("payroll/" + payroll.id, "PATCH", {});
    assert.equal((await good("payroll"))[0].status, "paid");
    const portal = await good(
      "customer-links",
      "POST",
      { customer_id: customer, purpose: "portal" },
      201,
    );
    const portalToken = new URL(portal.url).searchParams.get("token");
    const privacy = await good(
      "customer-link/" + portalToken + "/privacy",
      "POST",
      { type: "ugc_withdrawal" },
      201,
    );
    assert.equal(privacy.status, "completed");
  } finally {
    if (tenant) {
      await pool.query("BEGIN");
      try {
        for (const table of [
          "privacy_requests",
          "payroll_records",
          "action_tokens",
          "gift_card_redemptions",
          "membership_redemptions",
          "customer_memberships",
          "membership_plans",
          "loyalty_transactions",
          "loyalty_accounts",
          "gift_cards",
          "form_submissions",
          "forms",
          "ugc_submissions",
          "media",
          "reviews",
          "notifications",
          "jobs",
          "workflows",
          "campaigns",
          "commissions",
          "refunds",
          "payments",
          "order_items",
          "orders",
          "inventory_movements",
          "inventory_balances",
          "service_consumables",
          "purchase_order_items",
          "purchase_orders",
          "products",
          "suppliers",
          "appointment_services",
          "services",
          "appointments",
          "employee_leaves",
          "employee_schedules",
          "employees",
          "consent_records",
          "customers",
          "expenses",
          "action_tokens",
          "audit_logs",
          "tenant_features",
          "memberships",
          "roles",
          "branches",
        ])
          await pool.query("DELETE FROM " + table + " WHERE tenant_id=$1", [
            tenant,
          ]);
        await pool.query(
          "UPDATE sessions SET tenant_id=NULL WHERE tenant_id=$1",
          [tenant],
        );
        await pool.query("DELETE FROM tenants WHERE id=$1", [tenant]);
        await pool.query("COMMIT");
      } catch (e) {
        await pool.query("ROLLBACK");
        throw e;
      }
    }
    if (user) {
      await pool.query("DELETE FROM audit_logs WHERE actor_id=$1", [user]);
      await pool.query("DELETE FROM sessions WHERE user_id=$1", [user]);
      await pool.query("DELETE FROM users WHERE id=$1", [user]);
    }
    await pool.end();
  }
});
