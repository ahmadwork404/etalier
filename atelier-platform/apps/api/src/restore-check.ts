import "dotenv/config";
import { Pool } from "pg";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
const execute = promisify(execFile),
  dbName = process.env.DATABASE_NAME || "atelier",
  restoreName = "atelier_restore_qa_" + randomBytes(6).toString("hex");
const connection = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
};
const admin = new Pool({ ...connection, database: "postgres" }),
  source = new Pool({ ...connection, database: dbName });
const directory = fileURLToPath(new URL("../../../backups/", import.meta.url)),
  archive = directory + restoreName + ".dump";
const binary = process.env.PG_BIN || "C:/Program Files/PostgreSQL/18/bin/";
let created = false,
  target: Pool | undefined;
const args = [
  "-h",
  connection.host,
  "-p",
  String(connection.port),
  "-U",
  connection.user,
];
const env = { ...process.env, PGPASSWORD: connection.password };
try {
  await mkdir(directory, { recursive: true });
  await execute(
    binary + "pg_dump.exe",
    [...args, "-d", dbName, "--format=custom", "--file", archive],
    { env },
  );
  await admin.query('CREATE DATABASE "' + restoreName + '"');
  created = true;
  await execute(
    binary + "pg_restore.exe",
    [
      ...args,
      "-d",
      restoreName,
      "--no-owner",
      "--no-privileges",
      "--exit-on-error",
      archive,
    ],
    { env },
  );
  target = new Pool({ ...connection, database: restoreName });
  const tables = (
    await source.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    )
  ).rows;
  for (const { tablename } of tables) {
    if (!/^[a-z_]+$/.test(tablename)) throw Error("Unexpected identifier");
    const a = (
      await source.query(
        'SELECT count(*)::integer count FROM "' + tablename + '"',
      )
    ).rows[0].count;
    const b = (
      await target.query(
        'SELECT count(*)::integer count FROM "' + tablename + '"',
      )
    ).rows[0].count;
    if (a !== b) throw Error("Restore count mismatch for " + tablename);
  }
  console.log(
    JSON.stringify({
      restored: true,
      verifiedTables: tables.length,
      temporaryDatabase: restoreName,
    }),
  );
} catch (error) {
  console.error(
    "Backup/restore verification failed:",
    (error as Error).message,
  );
  process.exitCode = 1;
} finally {
  await target?.end();
  if (created && /^atelier_restore_qa_[a-f0-9]{12}$/.test(restoreName))
    await admin.query('DROP DATABASE "' + restoreName + '"');
  await source.end();
  await admin.end();
  try {
    await unlink(archive);
  } catch {}
}
