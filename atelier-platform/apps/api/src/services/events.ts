import type { PoolClient } from "pg";
export async function enqueueEvent(
  c: PoolClient,
  s: any,
  event: string,
  appointment: any,
) {
  const workflows = (
    await c.query(
      "SELECT * FROM workflows WHERE tenant_id=$1 AND trigger=$2 AND enabled",
      [s.tenant_id, event],
    )
  ).rows;
  for (const flow of workflows) {
    const job = (
      await c.query(
        "INSERT INTO jobs(tenant_id,feature_key,type,payload,deduplication_key,run_at) VALUES($1,'automations','notification',$2,$3,now()+$4*interval '1 minute') ON CONFLICT(deduplication_key) DO NOTHING RETURNING id",
        [
          s.tenant_id,
          JSON.stringify({
            customer_id: appointment.customer_id,
            channel: flow.channel,
            subject: flow.subject,
            body: flow.body,
            workflow_id: flow.id,
          }),
          "workflow:" + flow.id + ":" + appointment.id,
          flow.delay_minutes,
        ],
      )
    ).rows[0];
    if (job)
      await c.query(
        "INSERT INTO notifications(tenant_id,customer_id,channel,subject,body,job_id) VALUES($1,$2,$3,$4,$5,$6)",
        [
          s.tenant_id,
          appointment.customer_id,
          flow.channel,
          flow.subject,
          flow.body,
          job.id,
        ],
      );
  }
}
