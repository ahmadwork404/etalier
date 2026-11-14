import { pool, transaction } from "./db.js";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
try {
  await transaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(817302)");
    await c.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    for (const name of (await readdir(dir))
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      if (
        (await c.query("SELECT 1 FROM schema_migrations WHERE name=$1", [name]))
          .rowCount
      )
        continue;
      await c.query(await readFile(dir + name, "utf8"));
      await c.query("INSERT INTO schema_migrations(name) VALUES($1)", [name]);
      console.log("Applied", name);
    }
  });
} catch {
  console.error(
    "Migration failed. Verify PostgreSQL connection and extension permissions.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
