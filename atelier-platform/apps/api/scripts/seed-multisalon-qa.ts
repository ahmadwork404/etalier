import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
const file = new URL("../../../.qa/multi-salon-access.json", import.meta.url);
try {
  await readFile(file);
  console.log("Multi-salon QA fixture already exists.");
  process.exit(0);
} catch {}
let cookie = "";
async function call(path: string, body: unknown) {
  const response = await fetch("http://127.0.0.1:4000/api/v1/" + path, {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify(body),
  });
  const sessionCookie = response.headers.get("set-cookie");
  if (sessionCookie) cookie = sessionCookie.split(";")[0];
  const payload = (await response.json()) as any;
  if (!response.ok) throw Error(`${path}: ${payload.error?.message}`);
  return payload.data;
}
const account = {
  email: `multi.salon.qa.${Date.now()}@example.test`,
  password: `QA-${randomUUID()}`,
  name: "Multi Salon QA Owner",
};
await call("auth/register", account);
await call("auth/login", account);
const salons = [];
for (const name of ["QA City Studio", "QA Garden Studio"])
  salons.push(
    await call("tenants", { name, slug: "qa-multi-" + randomUUID() }),
  );
await writeFile(
  file,
  JSON.stringify(
    {
      ...account,
      salons: salons.map((salon) => ({ id: salon.id, name: salon.name })),
    },
    null,
    2,
  ),
);
console.log(
  "Created a separate two-salon QA owner. Credentials: .qa/multi-salon-access.json",
);
