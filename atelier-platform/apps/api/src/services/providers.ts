import { HttpError } from "../security.js";
import {
  contentForMessage,
  renderEmail,
  type EmailContent,
} from "./email-templates.js";
const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new HttpError(503, name + " is not configured");
  return value;
};
export function integrationStatus() {
  return {
    resend: !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM),
    twilio: !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM
    ),
    r2: !!(
      process.env.R2_ENDPOINT &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET
    ),
    stripe: !!(
      process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET
    ),
  };
}
export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  id: string,
  options?: { replyTo?: string; content?: EmailContent },
) {
  const rendered = await renderEmail(
    options?.content || contentForMessage(subject, text),
  );
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: "Bearer " + required("RESEND_API_KEY"),
      "Content-Type": "application/json",
      "Idempotency-Key": id,
    },
    body: JSON.stringify({
      from: required("RESEND_FROM"),
      to: [to],
      subject: subject.replace(/Atelier/g, "Etalier"),
      text: rendered.text,
      html: rendered.html,
      ...(options?.replyTo ? { reply_to: options.replyTo } : {}),
    }),
  });
  if (!response.ok)
    throw new HttpError(502, "Email provider rejected the request");
  return ((await response.json()) as { id: string }).id;
}
export async function sendSMS(to: string, text: string, whatsapp = false) {
  const account = required("TWILIO_ACCOUNT_SID");
  const from = required(whatsapp ? "TWILIO_WHATSAPP_FROM" : "TWILIO_FROM");
  const response = await fetch(
    "https://api.twilio.com/2010-04-01/Accounts/" + account + "/Messages.json",
    {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(account + ":" + required("TWILIO_AUTH_TOKEN")).toString(
            "base64",
          ),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: (whatsapp ? "whatsapp:" : "") + to,
        From: from,
        Body: text,
      }),
    },
  );
  if (!response.ok)
    throw new HttpError(502, "SMS provider rejected the request");
  return ((await response.json()) as { sid: string }).sid;
}
