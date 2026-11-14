import { pool } from "../db.js";
import { sendEmail } from "./providers.js";
import { portalUrl } from "./public-urls.js";
import { logger } from "../logger.js";

type Sender = typeof sendEmail;
export async function deliverLead(id: string, sender: Sender = sendEmail) {
  const lead = (
    await pool.query(
      `UPDATE contact_leads SET notification_status='sending',notification_attempts=notification_attempts+1,next_attempt_at=now()+interval '2 minutes'
    WHERE id=$1 AND ((notification_status='pending' AND next_attempt_at<=now()) OR (notification_status='sending' AND next_attempt_at<=now())) RETURNING *`,
      [id],
    )
  ).rows[0];
  if (!lead) return false;
  try {
    const providerId = await sender(
      process.env.LEAD_NOTIFICATION_TO || "ahmadshaukat328@gmail.com",
      "New Etalier enquiry — " + lead.name,
      "New enquiry",
      "contact-lead:" + lead.id,
      {
        replyTo: lead.email,
        content: {
          title: "New website enquiry",
          preview: `${lead.name} has contacted Etalier.`,
          paragraphs: [
            "A new enquiry has been saved in your Leads inbox.",
            lead.message,
          ],
          details: [
            { label: "Name", value: lead.name },
            { label: "Email", value: lead.email },
            ...(lead.salon_name
              ? [{ label: "Salon", value: lead.salon_name }]
              : []),
            ...(lead.phone ? [{ label: "Phone", value: lead.phone }] : []),
            ...(lead.team_size
              ? [{ label: "Team size", value: lead.team_size }]
              : []),
            {
              label: "Received",
              value: new Date(lead.created_at).toISOString(),
            },
          ],
          action: {
            label: "View enquiry",
            url: portalUrl() + "/admin/leads?lead=" + lead.id,
          },
          footer:
            "Reply to this email to contact the person who submitted the enquiry.",
        },
      },
    );
    await pool.query(
      "UPDATE contact_leads SET notification_status='sent',notification_id=$2,notification_error=NULL,notified_at=now() WHERE id=$1",
      [id, providerId],
    );
  } catch {
    // Provider responses can contain private information; only store a safe operational message.
    await pool.query(
      `UPDATE contact_leads SET notification_status=CASE WHEN notification_attempts>=5 THEN 'failed' ELSE 'pending' END,
      notification_error='Email could not be delivered. Check the email integration or retry.',next_attempt_at=now()+make_interval(secs=>LEAST(3600,60*power(2,notification_attempts)::integer)) WHERE id=$1`,
      [id],
    );
  }
  return true;
}
export async function processLeadNotifications() {
  const pending=(await pool.query("SELECT id FROM contact_leads WHERE notification_status IN ('pending','sending') AND next_attempt_at<=now() ORDER BY created_at LIMIT 10")).rows;
  for(const lead of pending)await deliverLead(lead.id);
}
export function startLeadNotifications() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await processLeadNotifications();
    } catch {
      logger.warn("lead_notifications_unavailable");
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), 30000);
  timer.unref();
  void tick();
}
