import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../src/db.js";

test("platform/shop boundary, location race, module restrictions and customer directory/profile", async () => {
  const users: string[] = [],
    shops: string[] = [];
  function client() {
    let cookie = "";
    return async (path: string, method = "GET", body?: unknown) => {
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
      return { status: response.status, ...payload };
    };
  }
  async function account(call: ReturnType<typeof client>, name: string) {
    const credentials = {
      email: randomUUID() + "@example.test",
      password: "QA-" + randomUUID(),
      name,
    };
    const created = await call("auth/register", "POST", credentials);
    assert.equal(created.status, 201);
    users.push(created.data.id);
    assert.equal((await call("auth/login", "POST", credentials)).status, 200);
    return { ...credentials, id: created.data.id };
  }
  const owner = client(),
    admin = client(),
    other = client();
  try {
    await account(owner, "QA owner");
    const ownerShop = await owner("tenants", "POST", {
      name: "QA boundary shop",
      slug: "qa-" + randomUUID(),
    });
    assert.equal(ownerShop.status, 201);
    shops.push(ownerShop.data.id);
    const shopId = ownerShop.data.id;
    const adminAccount = await account(admin, "QA platform admin");
    await pool.query(
      "UPDATE users SET platform_role='super_admin' WHERE id=$1",
      [adminAccount.id],
    );
    // Accidental membership must never give a platform account shop access.
    await pool.query(
      "INSERT INTO memberships(tenant_id,user_id,role_id) SELECT tenant_id,$1,id FROM roles WHERE tenant_id=$2 AND is_owner",
      [adminAccount.id, shopId],
    );
    const adminLogin = await admin("auth/login", "POST", adminAccount);
    assert.equal(adminLogin.status, 200);
    assert.equal(adminLogin.data.tenant_id, null);
    assert.equal(
      (
        await admin("tenants", "POST", {
          name: "Forbidden",
          slug: "forbidden-" + randomUUID(),
        })
      ).status,
      403,
    );
    assert.equal(
      (await admin("tenants/select", "POST", { id: shopId })).status,
      403,
    );
    assert.equal((await admin("customers")).status, 403);
    assert.deepEqual((await admin("tenants")).data, []);
    assert.equal((await owner("admin/tenants")).status, 403);
    assert.equal(
      (await owner("branches", "POST", { name: "Over limit" })).status,
      403,
    );
    assert.equal(
      (await admin("admin/tenants/" + shopId, "PATCH", { max_locations: 2 }))
        .status,
      200,
    );
    const race = await Promise.all([
      owner("branches", "POST", { name: "Location A" }),
      owner("branches", "POST", { name: "Location B" }),
    ]);
    assert.deepEqual(race.map((result) => result.status).sort(), [201, 403]);
    assert.equal(
      (await admin("admin/tenants/" + shopId, "PATCH", { max_locations: 1 }))
        .status,
      200,
    );
    assert.equal((await owner("branches", "POST", {name:"Beyond reduced allowance"})).status,403);
    assert.equal(
      (
        await admin("admin/features/customers", "PATCH", {
          tenant_id: shopId,
          enabled: false,
        })
      ).status,
      200,
    );
    assert.equal(
      (await owner("features/customers", "PATCH", { enabled: true })).status,
      403,
    );
    assert.equal((await owner("customers")).status, 403);
    await admin("admin/features/customers", "PATCH", {
      tenant_id: shopId,
      enabled: true,
    });
    const alpha = (
      await owner("customers", "POST", {
        name: "Alpha QA",
        email: "alpha.qa@example.test",
        phone: "03000000001",
        marketing_consent: true,
      })
    ).data;
    const beta = (
      await owner("customers", "POST", {
        name: "Beta QA",
        phone: "03000000002",
        marketing_consent: false,
      })
    ).data;
    const gamma = (
      await owner("customers", "POST", {
        name: "Gamma QA",
        marketing_consent: false,
      })
    ).data;
    assert.equal(
      (await owner("customers?q=alpha.qa%40example.test")).data.total,
      1,
    );
    assert.equal(
      (await owner("customers?q=03000000002")).data.items[0].id,
      beta.id,
    );
    assert.equal(
      (await owner("customers?contact=none")).data.items[0].id,
      gamma.id,
    );
    assert.equal(
      (await owner("customers?consent=yes")).data.items[0].id,
      alpha.id,
    );
    assert.equal(
      (await owner("customers?sort=name_desc")).data.items[0].id,
      gamma.id,
    );
    assert.equal((await owner("customers?contact=invalid")).status, 422);
    assert.equal((await owner(`customers/${alpha.id}/photo`)).status, 404);
    assert.equal(
      (
        await owner(`customers/${alpha.id}/photo/upload`, "POST", {
          content_type: "image/svg+xml",
          size_bytes: 100,
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await owner(`customers/${alpha.id}/photo/upload`, "POST", {
          content_type: "image/png",
          size_bytes: 6 * 1024 * 1024,
        })
      ).status,
      422,
    );
    if (!process.env.R2_ENDPOINT || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET) {
      assert.equal((await owner(`customers/${alpha.id}/photo/upload`, "POST", {content_type:"image/png",size_bytes:1024})).status,503);
    }
    assert.equal(
      (
        await owner(
          `customers/${alpha.id}/photo/${randomUUID()}/verify`,
          "POST",
          {},
        )
      ).status,
      404,
    );
    assert.equal(
      (await owner("customers/" + alpha.id)).data.customer.id,
      alpha.id,
    );
    assert.equal(
      (await owner(`customers/${alpha.id}/appointments?section=upcoming`)).data
        .total,
      0,
    );
    assert.equal(
      (await owner(`customers/${alpha.id}/appointments?section=past`)).data
        .total,
      0,
    );
    assert.equal((await owner(`customers/${alpha.id}/invoices`)).status, 200);
    const deniedSend = await owner(`customers/${alpha.id}/messages`, "POST", {
      channel: "email",
      subject: "QA",
      body: "Do not send",
      purpose: "service",
      idempotency_key: randomUUID(),
    });
    assert.ok([403, 503].includes(deniedSend.status));
    await account(other, "QA other owner");
    const otherShop = await other("tenants", "POST", {
      name: "QA unrelated shop",
      slug: "qa-" + randomUUID(),
    });
    shops.push(otherShop.data.id);
    assert.equal((await other("customers/" + alpha.id)).status, 404);
    assert.equal(
      (await other(`customers/${alpha.id}/appointments`)).status,
      404,
    );
    assert.equal((await other(`customers/${alpha.id}/invoices`)).status, 404);
    const members = (await admin(`admin/tenants/${shopId}/members`)).data;
    const ownerMember = members.find(
      (member: any) => member.name === "QA owner",
    );
    await admin(`admin/tenants/${shopId}/members/${ownerMember.id}`, "PATCH", {
      active: false,
    });
    assert.equal((await owner("customers")).status, 403);
    await admin(`admin/tenants/${shopId}/members/${ownerMember.id}`, "PATCH", {
      active: true,
    });
    await owner("tenants/select", "POST", { id: shopId });
    assert.equal((await owner("customers")).status, 200);
    await admin(`admin/tenants/${shopId}`, "PATCH", { status: "suspended" });
    assert.equal((await owner("customers")).status, 403);
    await admin(`admin/tenants/${shopId}`, "PATCH", { status: "active" });
    await admin(`admin/tenants/${shopId}/members/${ownerMember.id}`, "DELETE");
    assert.equal(
      (await owner("tenants/select", "POST", { id: shopId })).status,
      403,
    );
    const logs = await admin(
      "admin/audit?shop=" + shopId + "&user=" + adminAccount.id,
    );
    assert.equal(logs.status, 200);
    assert.ok(logs.data.items.length >= 5);
    assert.ok(
      logs.data.items.every(
        (entry: any) =>
          entry.actor_id === adminAccount.id && entry.tenant_id === shopId,
      ),
    );
  } finally {
    for (const id of shops) {
      for (const table of [
        "notifications",
        "jobs",
        "consent_records",
        "customers",
        "audit_logs",
        "tenant_features",
        "memberships",
        "branches",
        "roles",
      ])
        await pool.query("DELETE FROM " + table + " WHERE tenant_id=$1", [id]);
      await pool.query(
        "UPDATE sessions SET tenant_id=NULL WHERE tenant_id=$1",
        [id],
      );
      await pool.query("DELETE FROM tenants WHERE id=$1", [id]);
    }
    for (const id of users) {
      await pool.query("DELETE FROM audit_logs WHERE actor_id=$1", [id]);
      await pool.query("DELETE FROM sessions WHERE user_id=$1", [id]);
      await pool.query("DELETE FROM users WHERE id=$1", [id]);
    }
    await pool.end();
  }
});
