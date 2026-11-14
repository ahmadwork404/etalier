import { test } from "node:test";
import assert from "node:assert/strict";
import { digest, newToken, featureAllowed } from "../src/security.js";
test("session tokens are random, opaque, and hashed", () => {
  const a = newToken(),
    b = newToken();
  assert.notEqual(a, b);
  assert.equal(digest(a).length, 64);
  assert.notEqual(digest(a), a);
});
test("global denial overrides tenant enablement", () =>
  assert.equal(
    featureAllowed(
      { enabled: false, allowed_plans: ["starter"], dependency: null },
      true,
      "starter",
    ),
    false,
  ));
test("tenant denial overrides global enablement", () =>
  assert.equal(
    featureAllowed(
      { enabled: true, allowed_plans: ["starter"], dependency: null },
      false,
      "starter",
    ),
    false,
  ));
test("plan restrictions cannot be bypassed by tenant enablement", () =>
  assert.equal(
    featureAllowed(
      { enabled: true, allowed_plans: ["enterprise"], dependency: null },
      true,
      "starter",
    ),
    false,
  ));
test("dependency denial blocks dependent feature", () =>
  assert.equal(
    featureAllowed(
      { enabled: true, allowed_plans: ["starter"], dependency: "appointments" },
      true,
      "starter",
      false,
    ),
    false,
  ));
test("permitted feature can execute", () =>
  assert.equal(
    featureAllowed(
      { enabled: true, allowed_plans: ["starter"], dependency: null },
      true,
      "starter",
    ),
    true,
  ));
