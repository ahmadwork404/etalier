import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { z } from "zod";
import { app } from "../src/runtime.js";
import { register } from "../src/modules/contact-leads.js";
import { deliverLead } from "../src/services/contact-leads.js";
import { pool } from "../src/db.js";
import { digest, newToken, HttpError } from "../src/security.js";
import type { Request, Response, NextFunction } from "express";

test("contact enquiries persist once, are restricted to platform admins, and survive notification failures", async () => {
  register(app);
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) =>
    res
      .status(
        error instanceof z.ZodError
          ? 422
          : error instanceof HttpError
            ? error.status
            : 500,
      )
      .json({
        error: { message: error instanceof Error ? error.message : "Error" },
      }),
  );
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as { port: number };
  const keys = [randomUUID(), randomUUID()],
    users: string[] = [];
  const call = async (
    path: string,
    method = "GET",
    body?: unknown,
    cookie = "",
    origin = "https://etalier.app",
  ) => {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/` + path,
      {
        method,
        headers: { origin, "content-type": "application/json", cookie },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
    );
    return {
      status: response.status,
      body: (await response.json()) as any,
      allowOrigin: response.headers.get("access-control-allow-origin"),
    };
  };
  async function user(admin: boolean) {
    const id = randomUUID(),
      token = newToken();
    users.push(id);
    await pool.query(
      "INSERT INTO users(id,email,name,password_hash,platform_role,email_verified_at) VALUES($1,$2,'Lead integration fixture','unused',$3,now())",
      [id, id + "@example.test", admin ? "super_admin" : null],
    );
    await pool.query(
      "INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '1 hour')",
      [id, digest(token)],
    );
    return "atelier_session=" + token;
  }
  try {
    const owner = await user(false),
      admin = await user(true);
    const payload = {
      request_key: keys[0],
      name: "Alex Test",
      email: randomUUID() + "@example.test",
      salon_name: "Fixture Salon",
      team_size: "2–5",
      message: "Please show us how team scheduling works.",
      consent: true,
    };
    assert.equal((await call("contact-leads", "POST", payload)).status, 202);
    assert.equal((await call("contact-leads", "POST", payload)).status, 202);
    assert.equal(
      (
        await call("contact-leads", "POST", {
          ...payload,
          message: "A different message with the same key.",
        })
      ).status,
      409,
    );
    assert.equal(
      (await call("contact-leads", "POST", { ...payload, consent: false }))
        .status,
      422,
    );
    assert.equal(
      (
        await call("contact-leads", "POST", {
          ...payload,
          name: "<script>bad</script>",
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await call("contact-leads", "POST", {
          ...payload,
          request_key: keys[1],
          website: "spam.invalid",
        })
      ).status,
      202,
    );
    assert.equal(
      (await call("contact-leads", "POST", payload, "", "https://evil.example"))
        .status,
      403,
    );
    const rows = (
      await pool.query(
        "SELECT * FROM contact_leads WHERE request_key=ANY($1::uuid[])",
        [keys],
      )
    ).rows;
    assert.equal(rows.length, 1);
    const lead = rows[0];
    assert.equal((await call("admin/leads")).status, 401);
    assert.equal(
      (await call("admin/leads", "GET", undefined, owner)).status,
      403,
    );
    const list = await call(
      "admin/leads?q=" + encodeURIComponent(payload.email),
      "GET",
      undefined,
      admin,
    );
    assert.equal(list.status, 200);
    assert.equal(list.body.data.items.length, 1);
    const detail = await call(
      "admin/leads/" + lead.id,
      "GET",
      undefined,
      admin,
    );
    assert.equal(detail.body.data.payload_hash, undefined);
    assert.equal(
      (
        await call(
          "admin/leads/" + lead.id,
          "PATCH",
          { status: "qualified", admin_notes: "Arrange a walkthrough." },
          admin,
          "https://portal.etalier.app",
        )
      ).status,
      200,
    );
    let sends = 0;
    await Promise.all([
      deliverLead(lead.id, async (to, _subject, _text, id, options) => {
        sends++;
        assert.equal(
          to,
          process.env.LEAD_NOTIFICATION_TO || "ahmadshaukat328@gmail.com",
        );
        assert.equal(options?.replyTo, payload.email);
        assert.equal(id, "contact-lead:" + lead.id);
        return "mock-provider-id";
      }),
      deliverLead(lead.id, async () => {
        throw Error("A second sender must not claim this lead");
      }),
    ]);
    assert.equal(sends, 1);
    assert.equal(
      (
        await pool.query(
          "SELECT notification_status FROM contact_leads WHERE id=$1",
          [lead.id],
        )
      ).rows[0].notification_status,
      "sent",
    );
    await pool.query(
      "UPDATE contact_leads SET notification_status='pending',notification_attempts=0,next_attempt_at=now() WHERE id=$1",
      [lead.id],
    );
    await deliverLead(lead.id, async () => {
      throw Error("mock delivery failure");
    });
    const failed = (
      await pool.query("SELECT * FROM contact_leads WHERE id=$1", [lead.id])
    ).rows[0];
    assert.equal(failed.notification_status, "pending");
    assert.equal(failed.message, payload.message);
    assert.equal(failed.notification_attempts, 1);
    await pool.query(
      "UPDATE contact_leads SET notification_status='failed' WHERE id=$1",
      [lead.id],
    );
    assert.equal(
      (
        await call(
          "admin/leads/" + lead.id + "/retry",
          "POST",
          {},
          admin,
          "https://portal.etalier.app",
        )
      ).status,
      202,
    );
  } finally {
    await pool.query(
      "DELETE FROM contact_leads WHERE request_key=ANY($1::uuid[])",
      [keys],
    );
    await pool.query("DELETE FROM audit_logs WHERE actor_id=ANY($1::uuid[])", [
      users,
    ]);
    await pool.query("DELETE FROM sessions WHERE user_id=ANY($1::uuid[])", [
      users,
    ]);
    await pool.query("DELETE FROM users WHERE id=ANY($1::uuid[])", [users]);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});
