import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pool } from "../src/db.js";
const directory = new URL("../../../.qa/", import.meta.url);
let cookie = "";
async function call(path: string, method = "GET", body?: unknown) {
  const response = await fetch("http://127.0.0.1:4000/api/v1/" + path, {
    method,
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
      cookie,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const next = response.headers.get("set-cookie");
  if (next) cookie = next.split(";")[0];
  const payload = (await response.json()) as any;
  if (!response.ok) throw Error(`${path}: ${payload.error?.message}`);
  return payload.data;
}
try {
  const adminFile = new URL("platform-admin-access.json", directory);
  try {
    await readFile(adminFile);
  } catch {
    const credentials = {
      name: "QA Platform Administrator",
      email: "platform.qa." + Date.now() + "@example.test",
      password: "QA-" + randomUUID(),
    };
    const account = await call("auth/register", "POST", credentials);
    await pool.query(
      "UPDATE users SET platform_role='super_admin' WHERE id=$1",
      [account.id],
    );
    await writeFile(
      adminFile,
      JSON.stringify({ ...credentials, id: account.id }, null, 2),
    );
  }
  const owner = JSON.parse(
    await readFile(new URL("qa-access.json", directory), "utf8"),
  );
  await call("auth/login", "POST", owner);
  const customer = (await call("customers?q=Mariam")).items[0];
  await call("customers/" + customer.id, "PATCH", { phone: "+1 202-555-0123" });
  const customerDataFile = new URL("customer-profile-example.json", directory);
  try {
    await readFile(customerDataFile);
  } catch {
    const branch = (await call("branches")).find(
      (item: any) => item.name === "Main salon",
    );
    const employee = (await call("employees")).items.find(
      (item: any) => item.name === "Hamza Ali",
    );
    const service = (await call("services")).items.find(
      (item: any) => item.name === "Consultation",
    );
    const start = new Date(Date.now() + 9 * 86400000);
    start.setUTCHours(6, 0, 0, 0);
    const appointment = await call("appointments", "POST", {
      branch_id: branch.id,
      employee_id: employee.id,
      customer_id: customer.id,
      service_ids: [service.id],
      starts_at: start.toISOString(),
      notes: "QA customer profile upcoming example",
    });
    await writeFile(
      customerDataFile,
      JSON.stringify(
        {
          customerId: customer.id,
          url: "http://localhost:3000/customers/" + customer.id,
          appointmentId: appointment.id,
        },
        null,
        2,
      ),
    );
  }
  console.log(
    "Prepared synthetic platform admin and customer-profile sample. Credentials stay in .qa/.",
  );
} finally {
  await pool.end();
}
