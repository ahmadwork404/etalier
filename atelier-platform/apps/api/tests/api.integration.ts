import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../src/db.js";
test("API rejects workspace impersonation, feature bypass and session replay", async () => {
  let cookie = "";
  const users: string[] = [],
    tenants: string[] = [];
  const accounts: { email: string; password: string }[] = [];
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
    return { status: r.status, data: (await r.json()) as any };
  }
  try {
    assert.equal((await call("customers")).status, 401);
    for (let i = 0; i < 2; i++) {
      const email = "qa-" + randomUUID() + "@example.test",
        password = "QA-only-" + randomUUID();
      accounts.push({ email, password });
      const r = await call("auth/register", "POST", {
        email,
        password,
        name: "QA temporary",
      });
      assert.equal(r.status, 201);
      users.push(r.data.data.id);
      assert.equal(
        (await call("auth/login", "POST", { email, password })).status,
        200,
      );
      const t = await call("tenants", "POST", {
        name: "QA temporary salon",
        slug: "qa-" + randomUUID(),
      });
      assert.equal(t.status, 201);
      tenants.push(t.data.data.id);
      const singleSalonLogin = await call("auth/login", "POST", {
        email,
        password,
      });
      assert.equal(singleSalonLogin.status, 200);
      assert.equal(singleSalonLogin.data.data.tenant_id, t.data.data.id);
      assert.equal((await call("auth/me")).data.data.tenant_id, t.data.data.id);
      const invalidWorkspace = await call("tenants", "POST", {
        name: " ",
        slug: "My Salon",
      });
      assert.equal(invalidWorkspace.status, 422);
      assert.match(
        invalidWorkspace.data.error.issues.fieldErrors.name[0],
        /salon name/i,
      );
      assert.match(
        invalidWorkspace.data.error.issues.fieldErrors.slug[0],
        /lowercase letter/i,
      );
      const duplicateWorkspace = await call("tenants", "POST", {
        name: "QA duplicate",
        slug: t.data.data.slug,
      });
      assert.equal(duplicateWorkspace.status, 403);
      assert.match(duplicateWorkspace.data.error.message,/already belongs to a salon/i);
      assert.equal(
        (await call("customers", "POST", { name: "QA customer" })).status,
        201,
      );
    }
    assert.equal(
      (await call("tenants/select", "POST", { id: tenants[0] })).status,
      403,
    );
    assert.equal((await call("admin/tenants")).status, 403);
    const own = (await call("customers")).data.data.items;
    assert.equal(own.length, 1);
    assert.equal(own[0].tenant_id, tenants[1]);
    await pool.query(
      "UPDATE tenant_features SET enabled=false WHERE tenant_id=$1 AND feature_key='customers'",
      [tenants[1]],
    );
    assert.equal((await call("customers")).status, 403);
    const old = cookie;
    assert.equal((await call("auth/refresh", "POST")).status, 200);
    assert.notEqual(cookie, old);
    const rotated = cookie;
    cookie = old;
    assert.equal((await call("auth/me")).status, 401);
    await pool.query(
      "INSERT INTO memberships(tenant_id,user_id,role_id) SELECT tenant_id,$1,id FROM roles WHERE tenant_id=$2 AND is_owner LIMIT 1",
      [users[1], tenants[0]],
    );
    const multipleSalonLogin = await call("auth/login", "POST", accounts[1]);
    assert.equal(multipleSalonLogin.status, 200);
    assert.equal(multipleSalonLogin.data.data.tenant_id, null);
    assert.equal((await call("tenants")).data.data.length, 2);
    assert.equal((await call("auth/me")).data.data.tenant_id, null);
    assert.equal((await call("customers")).status, 403);
    cookie = rotated;
    assert.equal((await call("auth/logout", "POST")).status, 200);
    assert.equal((await call("auth/me")).status, 401);
  } finally {
    for (const id of tenants) {
      for (const table of [
        "audit_logs",
        "customers",
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
