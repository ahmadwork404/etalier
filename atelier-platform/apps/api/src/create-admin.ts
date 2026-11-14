import passwords from "./services/passwords.js";
import { pool, transaction, audit } from "./db.js";
const email = process.env.ADMIN_EMAIL,
  password = process.env.ADMIN_PASSWORD;
if (!email || !password || password.length < 16) {
  console.error(
    "Set ADMIN_EMAIL and ADMIN_PASSWORD (minimum 16 characters) for this command.",
  );
  process.exit(1);
}
try {
  const hash = await passwords.hash(password);
  await transaction(async (c) => {
    const r = await c.query(
      "INSERT INTO users(email,password_hash,name,platform_role,email_verified_at) VALUES($1,$2,'Platform administrator','super_admin',now()) RETURNING id",
      [email.toLowerCase(), hash],
    );
    await audit(c, r.rows[0].id, null, "platform.admin_bootstrapped");
  });
  console.log("Administrator created.");
} catch {
  console.error(
    "Could not create administrator. Check database access or duplicate email.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
