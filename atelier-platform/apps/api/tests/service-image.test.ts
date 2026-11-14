import { test } from "node:test";
import assert from "node:assert/strict";
import { validServiceImage } from "../src/services/service-image.js";
test("service images require matching raster signatures and bounded size", () => {
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    Buffer.alloc(20),
  ]);
  assert.equal(validServiceImage(png, "image/png"), true);
  assert.equal(validServiceImage(png, "image/jpeg"), false);
  assert.equal(
    validServiceImage(
      Buffer.from('<svg onload="alert(1)"></svg>'),
      "image/svg+xml",
    ),
    false,
  );
  assert.equal(
    validServiceImage(Buffer.from("not an image"), "image/png"),
    false,
  );
  assert.equal(validServiceImage(Buffer.alloc(0), "image/png"), false);
  assert.equal(
    validServiceImage(
      Buffer.concat([png, Buffer.alloc(2 * 1024 * 1024)]),
      "image/png",
    ),
    false,
  );
  assert.equal(
    validServiceImage(
      Buffer.from([255, 216, 255, ...Array(20).fill(0)]),
      "image/jpeg",
    ),
    true,
  );
  assert.equal(
    validServiceImage(Buffer.from("RIFF0000WEBP0000"), "image/webp"),
    true,
  );
});
