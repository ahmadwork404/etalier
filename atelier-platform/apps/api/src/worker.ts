import "dotenv/config";
import { pool, scoped } from "./db.js";
import { feature } from "./runtime.js";
import { sendEmail, sendSMS } from "./services/providers.js";
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
async function tick() {
  const tenants = (
    await pool.query("SELECT id,plan FROM tenants WHERE status='active'")
  ).rows;
  for (const tenant of tenants) {
    const claimed = await scoped(tenant.id, async (c) => {
      const row = (
        await c.query(
          "SELECT * FROM jobs WHERE tenant_id=$1 AND status='pending' AND run_at<=now() AND attempts<max_attempts ORDER BY run_at FOR UPDATE SKIP LOCKED LIMIT 1",
          [tenant.id],
        )
      ).rows[0];
      if (!row) return null;
      await c.query(
        "UPDATE jobs SET status='processing',attempts=attempts+1 WHERE tenant_id=$1 AND id=$2",
        [tenant.id, row.id],
      );
      return row.id;
    });
    if (!claimed) continue;
    await scoped(tenant.id, async (c) => {
      const job = (
        await c.query(
          "SELECT * FROM jobs WHERE tenant_id=$1 AND id=$2 AND status='processing' FOR UPDATE",
          [tenant.id, claimed],
        )
      ).rows[0];
      if (!job) return;
      try {
        await feature(tenant.id, job.feature_key, tenant.plan);
        await feature(tenant.id, job.payload.channel, tenant.plan);
        if (
          job.payload.workflow_id &&
          !(
            await c.query(
              "SELECT 1 FROM workflows WHERE tenant_id=$1 AND id=$2 AND enabled",
              [tenant.id, job.payload.workflow_id],
            )
          ).rowCount
        )
          throw Error("Workflow paused");
        if (
          job.payload.campaign_id &&
          !(
            await c.query(
              "SELECT 1 FROM campaigns WHERE tenant_id=$1 AND id=$2 AND status='queued'",
              [tenant.id, job.payload.campaign_id],
            )
          ).rowCount
        )
          throw Error("Campaign paused");
      } catch {
        await c.query(
          "UPDATE jobs SET status='disabled',last_error='Feature, dependency, tenant, or workflow disabled' WHERE tenant_id=$1 AND id=$2",
          [tenant.id, job.id],
        );
        await c.query(
          "UPDATE notifications SET status='suppressed' WHERE tenant_id=$1 AND job_id=$2",
          [tenant.id, job.id],
        );
        return;
      }
      const customer = (
        await c.query(
          "SELECT * FROM customers WHERE tenant_id=$1 AND id=$2 AND deleted_at IS NULL",
          [tenant.id, job.payload.customer_id],
        )
      ).rows[0];
      if (
        !customer ||
        customer.preferred_channel === "none" ||
        (job.feature_key === "marketing" && !customer.marketing_consent)
      ) {
        await c.query(
          "UPDATE jobs SET status='disabled',last_error='Customer opted out or unavailable' WHERE tenant_id=$1 AND id=$2",
          [tenant.id, job.id],
        );
        await c.query(
          "UPDATE notifications SET status='suppressed' WHERE tenant_id=$1 AND job_id=$2",
          [tenant.id, job.id],
        );
        return;
      }
      try {
        const text = String(job.payload.body).replaceAll(
          "{{name}}",
          customer.name,
        );
        let reference: string;
        if (job.payload.channel === "email") {
          if (!customer.email) throw Error("No customer email");
          reference = await sendEmail(
            customer.email,
            job.payload.subject,
            text,
            job.id,
          );
        } else {
          if (!customer.phone) throw Error("No customer phone");
          reference = await sendSMS(
            customer.phone,
            text,
            job.payload.channel === "whatsapp",
          );
        }
        await c.query(
          "UPDATE jobs SET status='completed',last_error=NULL WHERE tenant_id=$1 AND id=$2",
          [tenant.id, job.id],
        );
        await c.query(
          "UPDATE notifications SET status='sent',provider_reference=$3 WHERE tenant_id=$1 AND job_id=$2",
          [tenant.id, job.id, reference],
        );
      } catch {
        const retry =
          job.payload.channel === "email" && job.attempts < job.max_attempts;
        await c.query(
          "UPDATE jobs SET status=$3,run_at=now()+interval '5 minutes',last_error='Delivery failed; verify provider configuration and recipient' WHERE tenant_id=$1 AND id=$2",
          [tenant.id, job.id, retry ? "pending" : "failed"],
        );
        await c.query(
          "UPDATE notifications SET status='failed' WHERE tenant_id=$1 AND job_id=$2",
          [tenant.id, job.id],
        );
      }
    });
  }
}
while (!stopping) {
  try {
    await tick();
  } catch {
    console.error(
      JSON.stringify({ level: "error", event: "worker_tick_failed" }),
    );
  }
  await new Promise((r) => setTimeout(r, 3000));
}
await pool.end();
