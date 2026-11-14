import { mkdir, writeFile } from "node:fs/promises";
import {
  renderEmail,
  type EmailContent,
} from "../src/services/email-templates.js";
const templates: {
  alias: string;
  name: string;
  subject: string;
  variables: string[];
  content: EmailContent;
}[] = [
  {
    alias: "etalier-password-reset-v1",
    name: "Password reset",
    subject: "Reset your Etalier password",
    variables: ["ACTION_URL"],
    content: {
      title: "Reset your password",
      preview: "Your password reset link expires in 30 minutes.",
      paragraphs: [
        "We received a request to reset your Etalier password.",
        "Use the button below to choose a new password. This link expires in 30 minutes and can be used once.",
        "If you did not request this, you can ignore this email. Your password will stay the same.",
      ],
      action: { label: "Reset password", url: "{{{ACTION_URL}}}" },
    },
  },
  {
    alias: "etalier-email-verification",
    name: "Email verification",
    subject: "Confirm your Etalier email",
    variables: ["ACTION_URL"],
    content: {
      title: "Confirm your email address",
      preview: "Confirm your email address to use your Etalier account.",
      paragraphs: [
        "Confirm this email address to finish setting up your Etalier account.",
        "This link expires in 24 hours and can be used once. If you did not create an account, you can ignore this email.",
      ],
      action: { label: "Confirm email", url: "{{{ACTION_URL}}}" },
    },
  },
  {
    alias: "etalier-team-invitation",
    name: "Team invitation",
    subject: "You’re invited to Etalier",
    variables: ["ACTION_URL"],
    content: {
      title: "Your team invitation",
      preview: "You’ve been invited to join your team on Etalier.",
      paragraphs: [
        "You’ve been invited to join a salon workspace on Etalier.",
        "Use the button below to accept the invitation. This link expires in seven days. If you weren’t expecting it, you can ignore this email.",
      ],
      action: { label: "Accept invitation", url: "{{{ACTION_URL}}}" },
    },
  },
  {
    alias: "etalier-intake-request",
    name: "Intake request",
    subject: "Please complete your salon intake form",
    variables: ["ACTION_URL", "FORM_NAME", "EXPIRES_AT", "SUBMISSION_LIMIT"],
    content: {
      title: "{{{FORM_NAME}}}",
      preview: "Your salon has sent you an intake form.",
      paragraphs: [
        "Please complete this form before your visit so your salon can prepare for you.",
        "This private link expires at {{{EXPIRES_AT}}} and allows {{{SUBMISSION_LIMIT}}} submission(s). Please do not forward it.",
      ],
      action: { label: "Complete form", url: "{{{ACTION_URL}}}" },
      footer:
        "You received this form because your salon selected you as a recipient. Contact your salon if you were not expecting it.",
    },
  },
  {
    alias: "etalier-invoice",
    name: "Invoice receipt",
    subject: "Your salon invoice",
    variables: ["SALON_NAME", "INVOICE_NUMBER", "INVOICE_SUMMARY"],
    content: {
      title: "Your invoice from {{{SALON_NAME}}}",
      preview: "Invoice {{{INVOICE_NUMBER}}}",
      paragraphs: [
        "Thank you for your visit. Here is your invoice and payment summary.",
        "{{{INVOICE_SUMMARY}}}",
      ],
      details: [{ label: "Invoice", value: "{{{INVOICE_NUMBER}}}" }],
      footer:
        "Please keep this email for your records. Questions about a visit or payment should be directed to your salon.",
    },
  },
  {
    alias: "etalier-lead-notification",
    name: "Lead notification",
    subject: "New Etalier website enquiry",
    variables: [
      "ACTION_URL",
      "CONTACT_NAME",
      "CONTACT_EMAIL",
      "SALON_NAME",
      "ENQUIRY_MESSAGE",
    ],
    content: {
      title: "New website enquiry",
      preview: "A new enquiry has been saved in your Leads inbox.",
      paragraphs: [
        "A new enquiry has been saved in your Leads inbox.",
        "{{{ENQUIRY_MESSAGE}}}",
      ],
      details: [
        { label: "Name", value: "{{{CONTACT_NAME}}}" },
        { label: "Email", value: "{{{CONTACT_EMAIL}}}" },
        { label: "Salon", value: "{{{SALON_NAME}}}" },
      ],
      action: { label: "View enquiry", url: "{{{ACTION_URL}}}" },
      footer:
        "Reply to this email to contact the person who submitted the enquiry.",
    },
  },
];
const output = new URL("../../../.qa/email-previews/", import.meta.url);
await mkdir(output, { recursive: true });
const rendered = [];
for (const template of templates) {
  const { html, text } = await renderEmail(template.content);
  await writeFile(new URL(template.alias + ".html", output), html);
  rendered.push({ ...template, html, text });
}
await writeFile(new URL("templates.json", output), JSON.stringify(rendered));
console.log(`Rendered ${rendered.length} email previews.`);
