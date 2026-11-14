import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../src/db.js";
test("PostgreSQL enforces tenant isolation, composite foreign keys, and concurrent booking exclusion", async () => {
  const c = await pool.connect();
  const role = "atelier_test_" + randomUUID().replaceAll("-", "");
  try {
    await c.query("BEGIN");
    const t1 = (
      await c.query(
        "INSERT INTO tenants(name,slug) VALUES('Isolation A',$1) RETURNING id",
        ["qa-" + randomUUID()],
      )
    ).rows[0].id;
    const t2 = (
      await c.query(
        "INSERT INTO tenants(name,slug) VALUES('Isolation B',$1) RETURNING id",
        ["qa-" + randomUUID()],
      )
    ).rows[0].id;
    const customer = (
      await c.query(
        "INSERT INTO customers(tenant_id,name) VALUES($1,'Isolated customer') RETURNING id",
        [t1],
      )
    ).rows[0].id;
    const b = (
      await c.query(
        "INSERT INTO branches(tenant_id,name) VALUES($1,'Test branch') RETURNING id",
        [t1],
      )
    ).rows[0].id;
    const e = (
      await c.query(
        "INSERT INTO employees(tenant_id,branch_id,name) VALUES($1,$2,'Test stylist') RETURNING id",
        [t1, b],
      )
    ).rows[0].id;
    await c.query(
      "INSERT INTO appointments(tenant_id,branch_id,customer_id,employee_id,starts_at,ends_at) VALUES($1,$2,$3,$4,'2030-01-01T09:00Z','2030-01-01T10:00Z')",
      [t1, b, customer, e],
    );
    await c.query("SAVEPOINT overlap");
    await assert.rejects(
      c.query(
        "INSERT INTO appointments(tenant_id,branch_id,customer_id,employee_id,starts_at,ends_at) VALUES($1,$2,$3,$4,'2030-01-01T09:30Z','2030-01-01T10:30Z')",
        [t1, b, customer, e],
      ),
      (err: any) => err.code === "23P01",
    );
    await c.query("ROLLBACK TO overlap");
    await c.query("SAVEPOINT cross_tenant_fk");
    await assert.rejects(
      c.query(
        "INSERT INTO employees(tenant_id,branch_id,name) VALUES($1,$2,'Invalid assignment')",
        [t2, b],
      ),
      (err: any) => err.code === "23503",
    );
    await c.query("ROLLBACK TO cross_tenant_fk");
    await c.query(`CREATE ROLE ${role} NOLOGIN`);
    await c.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
    await c.query(`GRANT SELECT,INSERT ON customers TO ${role}`);
    await c.query(`SET LOCAL ROLE ${role}`);
    await c.query("SELECT set_config('app.tenant_id',$1,true)", [t2]);
    assert.equal(
      (await c.query("SELECT id FROM customers WHERE id=$1", [customer]))
        .rowCount,
      0,
    );
    await c.query("SELECT set_config('app.tenant_id',$1,true)", [t1]);
    assert.equal(
      (await c.query("SELECT id FROM customers WHERE id=$1", [customer]))
        .rowCount,
      1,
    );
    await c.query("SAVEPOINT rls_write");
    await assert.rejects(
      c.query(
        "INSERT INTO customers(tenant_id,name) VALUES($1,'Cross tenant write')",
        [t2],
      ),
      (err: any) => err.code === "42501",
    );
    await c.query("ROLLBACK TO rls_write");
  } finally {
    await c.query("ROLLBACK");
    c.release();
    await pool.end();
  }
});
