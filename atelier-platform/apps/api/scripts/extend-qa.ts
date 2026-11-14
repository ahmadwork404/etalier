import { readFile, writeFile, access } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const directory = new URL("../../../.qa/", import.meta.url);
const reportFile = new URL("qa-extended-checks.json", directory);
try {
  await access(reportFile);
  console.log("Extended QA checks already completed; no records added.");
  process.exit(0);
} catch {}
const account = JSON.parse(
  await readFile(new URL("qa-access.json", directory), "utf8"),
);
let cookie = "";
const results: { route: string; status: number; expected: number }[] = [];
async function call(
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
  // Tokens and codes are intentionally excluded from logs.
  results.push({
    route: route.replace(
      /customer-link\/[A-Za-z0-9_-]+/,
      "customer-link/[private-token]",
    ),
    status: response.status,
    expected,
  });
  assert.equal(
    response.status,
    expected,
    `${method} ${route.split("/")[0]}: ${JSON.stringify(payload.error)}`,
  );
  return payload.data;
}
await call("auth/login", "POST", {
  email: account.email,
  password: account.password,
});
await call("tenants/select", "POST", { id: account.salonId });
const customer = (await call("customers?q=Mariam")).items[0];
const services = (await call("services")).items;
const employees = (await call("employees")).items;
const branch = (await call("branches"))[0];
const form = (await call("forms"))[0];
async function link(purpose: string, resource_id?: string) {
  const result = await call(
    "customer-links",
    "POST",
    {
      customer_id: customer.id,
      purpose,
      ...(resource_id ? { resource_id } : {}),
    },
    201,
  );
  return new URL(result.url).searchParams.get("token");
}
const formToken = await link("form", form.id);
await call(
  "customer-link/" + formToken,
  "POST",
  { answers: { preferences: "Morning treatment", consent: false } },
  422,
);
await call("customer-link/" + formToken, "POST", {
  answers: { preferences: "Morning treatment", consent: true },
});
await call(
  "customer-link/" + formToken,
  "POST",
  { answers: { preferences: "Replay", consent: true } },
  403,
);
const reviewToken = await link("review");
await call(
  "customer-link/" + reviewToken,
  "POST",
  { rating: 6, body: "Invalid rating" },
  422,
);
await call("customer-link/" + reviewToken, "POST", {
  rating: 5,
  body: "Synthetic QA review: lovely haircut and friendly team.",
});
const ugcToken = await link("ugc");
await call("customer-link/" + ugcToken, "POST", {
  testimonial: "Synthetic QA testimonial for review only.",
  consent_granted: false,
  consent_text: "I have not granted permission for marketing use.",
});
const loyaltyKey = randomUUID();
const points = {
  customer_id: customer.id,
  points: 150,
  reason: "QA welcome points",
  idempotency_key: loyaltyKey,
};
const first = await call("loyalty", "POST", points, 201);
const replay = await call("loyalty", "POST", points, 201);
assert.equal(first.id, replay.id);
await call(
  "loyalty",
  "POST",
  { ...points, points: -9999, idempotency_key: randomUUID() },
  409,
);
const plan = await call(
  "membership-plans",
  "POST",
  {
    name: "QA Monthly Care",
    price_minor: 1200000,
    duration_days: 30,
    service_credits: 3,
  },
  201,
);
await call(
  "memberships",
  "POST",
  { customer_id: customer.id, plan_id: plan.id },
  201,
);
const gift = await call(
  "gift-cards",
  "POST",
  { initial_minor: 500000, expires_on: "2028-12-31" },
  201,
);
await writeFile(
  new URL("qa-gift-code.json", directory),
  JSON.stringify(
    { note: "Synthetic QA gift card only", code: gift.code },
    null,
    2,
  ),
);
await call(
  "workflows",
  "POST",
  {
    name: "QA reminder (disabled)",
    trigger: "appointment.created",
    channel: "email",
    delay_minutes: 60,
    subject: "QA reminder",
    body: "Synthetic workflow. Keep disabled.",
    enabled: false,
  },
  201,
);
await call(
  "campaigns",
  "POST",
  {
    name: "QA campaign draft",
    channel: "email",
    subject: "QA draft",
    body: "Synthetic draft only. Not queued for delivery.",
  },
  201,
);
await call("settings", "PATCH", {
  address: "Synthetic QA studio",
  booking_min_hours: 0,
  cancel_hours: 0,
});
const publicData = await call("booking/" + account.slug);
assert.ok(publicData.services.length >= 4);
const date = new Date(Date.now() + 3 * 86400000);
date.setUTCHours(6, 0, 0, 0);
const stylist = employees.find(
  (employee: any) => employee.name === "Hamza Ali",
);
const service = services.find((item: any) => item.name === "Signature haircut");
const publicPayload = {
  name: "QA Public Client",
  email: "public.client@example.test",
  phone: "0000000000",
  branch_id: branch.id,
  employee_id: stylist.id,
  service_ids: [service.id],
  starts_at: date.toISOString(),
};
const booking = await call(
  "booking/" + account.slug,
  "POST",
  publicPayload,
  201,
);
await call("booking/" + account.slug, "POST", publicPayload, 409);
assert.ok(booking.reference);
const portalToken = await link("portal");
await call("customer-link/" + portalToken);
for (const route of [
  "reviews",
  "ugc-submissions",
  "form-submissions",
  "loyalty",
  "membership-plans",
  "memberships",
  "gift-cards",
  "workflows",
  "campaigns",
])
  assert.ok((await call(route)).length > 0);
await call("settings", "PATCH", { timezone: "Not/A_Zone" }, 422);
await call("settings", "PATCH", { currency: "XYZ" }, 422);
await writeFile(
  reportFile,
  JSON.stringify(
    { salon: account.salonName, checkedAt: new Date().toISOString(), results },
    null,
    2,
  ),
);
console.log(
  `Extended QA data and ${results.length} checks completed. No provider messages sent.`,
);
