import { randomUUID } from "node:crypto";
import { mkdir, writeFile, access } from "node:fs/promises";
import assert from "node:assert/strict";

// Persistent synthetic data, deliberately separate from disposable integration fixtures.
const outputDirectory = new URL("../../../.qa/", import.meta.url);
const accessFile = new URL("qa-access.json", outputDirectory);
try {
  await access(accessFile);
  console.log(
    "QA salon already exists. See .qa/qa-access.json. No data changed.",
  );
  process.exit(0);
} catch {}
let cookie = "";
const results: { route: string; status: number; expected: number }[] = [];
async function request(
  route: string,
  method = "GET",
  body?: unknown,
  expected = 200,
): Promise<any> {
  const response = await fetch("http://127.0.0.1:4000/api/v1/" + route, {
    method,
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
      cookie,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const sessionCookie = response.headers.get("set-cookie");
  if (sessionCookie) cookie = sessionCookie.split(";")[0];
  const payload = (await response.json()) as any;
  results.push({ route, status: response.status, expected });
  assert.equal(
    response.status,
    expected,
    `${method} ${route}: ${JSON.stringify(payload.error)}`,
  );
  return payload.data;
}
const email = `salon.qa.${Date.now()}@example.test`;
const password = `QA-${randomUUID()}`;
await request(
  "auth/register",
  "POST",
  { name: "QA Salon Owner", email, password },
  201,
);
await request("auth/login", "POST", { email, password });
const salon = await request(
  "tenants",
  "POST",
  { name: "Atelier QA Studio", slug: `atelier-qa-${Date.now()}` },
  201,
);
await mkdir(outputDirectory, { recursive: true });
await writeFile(
  accessFile,
  JSON.stringify(
    {
      email,
      password,
      salonName: salon.name,
      salonId: salon.id,
      slug: salon.slug,
      url: "http://localhost:3000",
      syntheticDataOnly: true,
    },
    null,
    2,
  ),
);
const features = await request("features");
for (const key of [
  "customers",
  "employees",
  "services",
  "appointments",
  "inventory",
  "pos",
  "analytics",
  "forms",
  "portal",
  "public_booking",
  "loyalty",
  "memberships",
  "gift_cards",
  "reviews",
  "ugc",
  "marketing",
  "automations",
]) {
  const feature = features.find((item: any) => item.key === key);
  if (feature?.enabled && feature.allowed_plans?.includes(salon.plan))
    await request("features/" + key, "PATCH", { enabled: true });
}
const branch = (await request("branches"))[0];
const secondBranch = await request(
  "branches",
  "POST",
  { name: "Garden Studio", address: "Synthetic QA location" },
  201,
);
const employees = [];
for (const [name, title] of [
  ["Ayesha Khan", "Senior stylist"],
  ["Sara Ahmed", "Skin specialist"],
  ["Hamza Ali", "Color specialist"],
]) {
  const employee = await request(
    "employees",
    "POST",
    { name, title, branch_id: branch.id },
    201,
  );
  employees.push(employee);
  for (let weekday = 0; weekday < 7; weekday++)
    await request(
      "employee-schedules",
      "POST",
      {
        employee_id: employee.id,
        weekday,
        opens_at: "08:00",
        closes_at: "20:00",
      },
      201,
    );
}
await request(
  "employees",
  "POST",
  {
    name: "Noor Fatima",
    title: "New stylist · hours not configured",
    branch_id: secondBranch.id,
  },
  201,
);
const customers = [];
for (let index = 0; index < 28; index++) {
  const names = [
    "Mariam Shah",
    "Zoya Malik",
    "Hina Raza",
    "Ali Hassan",
    "Fatima Noor",
    "Sana Iqbal",
    "Amna Sheikh",
  ];
  customers.push(
    await request(
      "customers",
      "POST",
      {
        name: index < names.length ? names[index] : `QA Customer ${index + 1}`,
        email: `qa.customer.${index}@example.test`,
        notes:
          index === 0
            ? "Synthetic client: prefers morning appointments."
            : "Synthetic QA record",
        marketing_consent: false,
      },
      201,
    ),
  );
}
const firstPage = await request("customers?page=1");
const secondPage = await request("customers?page=2");
assert.equal(firstPage.items.length, 25);
assert.equal(secondPage.items.length, 3);
assert.equal((await request("customers?q=no-such-qa-name")).items.length, 0);
const services = [];
for (const [name, duration, price] of [
  ["Signature haircut", 45, 350000],
  ["Glow facial", 60, 500000],
  ["Color & treatment", 90, 800000],
  ["Consultation", 15, 0],
] as const)
  services.push(
    await request(
      "services",
      "POST",
      { name, duration_minutes: duration, price_minor: price },
      201,
    ),
  );
const supplier = await request(
  "suppliers",
  "POST",
  { name: "QA Beauty Supply", email: "supplier@example.test" },
  201,
);
const products = [];
for (const [name, stock] of [
  ["Hydrating shampoo", 30],
  ["Repair conditioner", 2],
  ["Color treatment", 0],
] as const) {
  const product = await request(
    "products",
    "POST",
    {
      name,
      sku: `QA-${randomUUID().slice(0, 8)}`,
      supplier_id: supplier.id,
      price_minor: 120000,
      cost_minor: 60000,
      minimum_stock: 5,
    },
    201,
  );
  products.push(product);
  if (stock)
    await request(
      "inventory/movements",
      "POST",
      {
        branch_id: branch.id,
        product_id: product.id,
        quantity: stock,
        reason: "purchase",
      },
      201,
    );
}
await request(
  "service-consumables",
  "POST",
  { service_id: services[0].id, product_id: products[0].id, quantity: 1 },
  201,
);
await request(
  "expenses",
  "POST",
  {
    name: "QA supplies expense",
    branch_id: branch.id,
    amount_minor: 250000,
    incurred_on: new Date().toISOString().slice(0, 10),
  },
  201,
);
const tomorrow = new Date(Date.now() + 86400000);
tomorrow.setUTCHours(6, 0, 0, 0);
for (let index = 0; index < 5; index++) {
  const starts = new Date(tomorrow.getTime() + index * 3600000);
  const appointment = await request(
    "appointments",
    "POST",
    {
      branch_id: branch.id,
      employee_id: employees[0].id,
      customer_id: customers[index].id,
      service_ids: [services[0].id],
      starts_at: starts.toISOString(),
      notes: "Synthetic QA appointment",
    },
    201,
  );
  if (index === 0) {
    await request("appointments/" + appointment.id, "PATCH", {
      status: "completed",
    });
    const order = await request(
      "orders",
      "POST",
      {
        branch_id: branch.id,
        customer_id: customers[0].id,
        appointment_id: appointment.id,
        items: [{ kind: "product", id: products[0].id, quantity: 1 }],
        idempotency_key: randomUUID(),
      },
      201,
    );
    const payment = await request(
      `orders/${order.id}/payments`,
      "POST",
      {
        amount_minor: Number(order.total_minor),
        method: "cash",
        idempotency_key: randomUUID(),
      },
      201,
    );
    await request(
      `payments/${payment.id}/refunds`,
      "POST",
      {
        amount_minor: 20000,
        reason: "Synthetic refund",
        idempotency_key: randomUUID(),
      },
      201,
    );
  } else if (index < 4)
    await request("appointments/" + appointment.id, "PATCH", {
      status: ["", "checked_in", "cancelled", "no_show"][index],
    });
}
await request(
  "orders",
  "POST",
  {
    branch_id: branch.id,
    customer_id: customers[1].id,
    items: [{ kind: "product", id: products[0].id, quantity: 1 }],
    idempotency_key: randomUUID(),
  },
  201,
);
await request(
  "forms",
  "POST",
  {
    name: "New client consultation",
    fields: [
      {
        key: "preferences",
        label: "Your treatment preferences",
        type: "textarea",
        required: true,
      },
      {
        key: "consent",
        label: "I consent to the treatment",
        type: "consent",
        required: true,
      },
    ],
  },
  201,
);
const payroll = await request(
  "payroll",
  "POST",
  {
    employee_id: employees[0].id,
    period_start: "2026-11-01",
    period_end: "2026-11-30",
    base_minor: 5000000,
  },
  201,
);
await request("payroll/" + payroll.id, "PATCH", {});
await request(
  "payroll",
  "POST",
  {
    employee_id: employees[1].id,
    period_start: "2026-11-01",
    period_end: "2026-11-30",
    base_minor: 4500000,
  },
  201,
);
const future = new Date(tomorrow.getTime() + 7 * 86400000);
await request(
  "employee-leaves",
  "POST",
  {
    employee_id: employees[1].id,
    starts_at: future.toISOString(),
    ends_at: new Date(future.getTime() + 86400000).toISOString(),
    reason: "QA planned leave",
  },
  201,
);
// Negative cases must reject without creating records.
await request(
  "services",
  "POST",
  { name: "Invalid price", duration_minutes: 45, price_minor: -1 },
  422,
);
await request(
  "employee-leaves",
  "POST",
  {
    employee_id: employees[0].id,
    starts_at: future.toISOString(),
    ends_at: tomorrow.toISOString(),
    reason: "Invalid interval",
  },
  422,
);
await request(
  "inventory/movements",
  "POST",
  {
    branch_id: branch.id,
    product_id: products[0].id,
    quantity: -999,
    reason: "adjustment",
  },
  409,
);
for (const route of [
  "branches",
  "employees",
  "services",
  "products",
  "suppliers",
  "inventory",
  "inventory/movements",
  "service-consumables",
  "orders",
  "payments",
  "expenses",
  "commissions",
  "payroll",
  "forms",
  "form-submissions",
  "members",
  "integrations",
  "roles",
  "audit",
])
  await request(route);
await writeFile(
  new URL("qa-checks.json", outputDirectory),
  JSON.stringify(
    { salon: salon.name, checkedAt: new Date().toISOString(), checks: results },
    null,
    2,
  ),
);
console.log(
  `Created ${salon.name}: ${results.length} API checks passed. Local sign-in details: .qa/qa-access.json`,
);
