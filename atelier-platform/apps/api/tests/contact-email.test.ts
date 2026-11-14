import { test } from "node:test";
import assert from "node:assert/strict";
import {
  renderEmail,
  contentForMessage,
  invoiceEmail,
} from "../src/services/email-templates.js";
import { allowedOrigins } from "../src/services/public-urls.js";
test("transactional templates escape submitted content and include a readable text alternative", async () => {
  const result = await renderEmail({
    title: "New enquiry",
    preview: "A website enquiry",
    paragraphs: ['<script>alert("unsafe")</script> & a question'],
    details: [{ label: "Salon", value: "<img src=x onerror=alert(1)>" }],
  });
  assert.ok(!result.html.includes("<script>"));
  assert.ok(!result.html.includes("<img src=x"));
  assert.ok(result.html.includes("&lt;script&gt;"));
  assert.ok(result.text.includes("a question"));
  assert.ok(result.html.includes("etalier.app"));
  assert.ok(!/https?:\/\/[^" ]*(?:tracking|pixel)/i.test(result.html));
});
test("reset messages expose only the intended portal action", () => {
  process.env.PUBLIC_APP_URL = "https://portal.etalier.app";
  const result = contentForMessage(
    "Reset your Etalier password",
    "Use https://evil.example/fake then https://portal.etalier.app/reset?token=opaque",
  );
  assert.equal(
    result.action?.url,
    "https://portal.etalier.app/reset?token=opaque",
  );
  assert.ok(result.paragraphs.join(" ").includes("30 minutes"));
});
test("receipt templates use actual payment and refund amounts", async () => {
  const content = invoiceEmail({
    number: "INV-TEST",
    order: {
      salon_name: "Test Salon",
      customer_name: "Alex",
      currency: "EUR",
      created_at: "2026-11-14T12:00:00Z",
      subtotal_minor: 5000,
      discount_minor: 0,
      tax_minor: 0,
      tip_minor: 0,
      total_minor: 5000,
    },
    items: [{ name: "Haircut", quantity: 1, price_minor: 5000 }],
    summary: {
      label: "Partially paid",
      paid_minor: 3000,
      refunded_minor: 0,
      balance_minor: 2000,
    },
  });
  const result = await renderEmail(content);
  assert.ok(result.text.includes("Amount due: €20.00"));
  assert.ok(result.text.includes("Payments received: €30.00"));
  assert.ok(!result.text.includes("Refunded:"));
  assert.ok(result.html.includes("<table"));
});
test("production origins include both application domains without arbitrary origins", () => {
  const origins = allowedOrigins();
  assert.ok(origins.has("https://etalier.app"));
  assert.ok(origins.has("https://portal.etalier.app"));
  assert.ok(!origins.has("https://etalier.app.evil.example"));
  assert.ok(!origins.has("*"));
});
