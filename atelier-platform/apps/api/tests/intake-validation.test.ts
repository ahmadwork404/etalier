import { test } from "node:test";
import assert from "node:assert/strict";
import {
  plainText,
  intakeDefinition,
  validateAnswers,
  deviceSummary,
  type IntakeField,
} from "../src/services/intake-validation.js";
const fields: IntakeField[] = [
  { key: "name", label: "Name", type: "text", required: true },
  { key: "consent", label: "Consent", type: "consent", required: true },
  {
    key: "choice",
    label: "Preference",
    type: "select",
    required: true,
    options: ["A", "B"],
  },
  { key: "day", label: "Date", type: "date", required: false },
];
test("intake validates typed answers, strips markup and rejects unknown keys", () => {
  assert.equal(plainText(" <b>Hello</b>\u0000 "), "Hello");
  assert.deepEqual(
    validateAnswers(fields, {
      name: " <b>Ali</b> ",
      consent: true,
      choice: "A",
    }),
    { name: "Ali", consent: true, choice: "A" },
  );
  for (const answers of [
    { name: " ", consent: true, choice: "A" },
    { name: "Ali", consent: "true", choice: "A" },
    { name: "Ali", consent: false, choice: "A" },
    { name: "Ali", consent: true, choice: "C" },
    { name: "Ali", consent: true, choice: "A", extra: "value" },
    { name: true, consent: true, choice: "A" },
    { name: "Ali", consent: true, choice: "A", day: "2026-02-30" },
  ])
    assert.throws(() => validateAnswers(fields, answers));
  assert.equal(
    validateAnswers(fields, {
      name: "Ali",
      consent: true,
      choice: "A",
      day: "2024-02-29",
    }).day,
    "2024-02-29",
  );
});
test("form definitions reject duplicate keys, dangerous names and empty choices", () => {
  assert.equal(
    intakeDefinition.safeParse({ name: "Form", fields: [fields[0], fields[0]] })
      .success,
    false,
  );
  assert.equal(
    intakeDefinition.safeParse({
      name: "Form",
      fields: [{ ...fields[0], key: "constructor" }],
    }).success,
    false,
  );
  assert.equal(
    intakeDefinition.safeParse({
      name: "Form",
      fields: [{ ...fields[2], options: [] }],
    }).success,
    false,
  );
  assert.equal(
    intakeDefinition.parse({
      name: " <b>Consultation</b> ",
      fields: [fields[0]],
    }).name,
    "Consultation",
  );
});
test("device summary reports indicative browser and OS without fingerprinting", () => {
  const device = deviceSummary(
    "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Edg/120.0",
    { language: "en-PK", timezone: "Asia/Karachi", screen: "1920 × 1080" },
  );
  assert.equal(device.os, "Windows");
  assert.equal(device.browser, "Edge");
  assert.equal(device.type, "Desktop");
  assert.equal(device.timezone, "Asia/Karachi");
});
