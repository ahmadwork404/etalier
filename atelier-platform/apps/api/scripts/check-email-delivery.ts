import "dotenv/config";
import { randomUUID } from "node:crypto";
import { sendEmail } from "../src/services/providers.js";
if (!process.argv.includes("--send-check"))
  throw new Error(
    "Pass --send-check to send one setup confirmation to the configured owner address.",
  );
const id = await sendEmail(
  process.env.LEAD_NOTIFICATION_TO || "ahmadshaukat328@gmail.com",
  "Etalier email delivery is configured",
  "Your Etalier email delivery is configured.",
  "setup-check:" + randomUUID(),
  {
    content: {
      title: "Your Etalier emails are ready",
      preview:
        "This confirms that Etalier can send email from its verified domain.",
      paragraphs: [
        "This message confirms that Etalier can send email from notifications@etalier.app to your lead notification address.",
        "Website enquiries will be saved in the platform admin Leads inbox and sent to this address. You can reply to a notification to contact the person who submitted it.",
        "The contact page is ready in the local project. Live enquiries will be available after the frontends and backend have been deployed.",
      ],
      footer:
        "This is a setup confirmation for your Etalier application. No customer emails were sent.",
    },
  },
);
console.log(JSON.stringify({ email_id: id, accepted: true }));
