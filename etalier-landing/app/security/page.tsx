import { pageMetadata } from "@/lib/seo";
import { SiteHeader, SiteFooter, ContactCTA } from "@/components/SiteChrome";
export const metadata = pageMetadata({
  title: "Security & Data Handling | Etalier",
  description:
    "Read how Etalier handles salon access, passwords, sessions, private uploads, intake links and customer data.",
  path: "/security",
});
export default function SecurityPage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="editorial-hero">
          <h1>
            Your workspace.
            <br />
            <em>Clear boundaries.</em>
          </h1>
          <p>
            Customer records and team information deserve deliberate handling.
            Here is what the application does, and what your salon should decide
            before using it.
          </p>
        </section>
        <div className="security-sections editorial-section">
          {[
            [
              "Workspace access",
              "Authenticated requests are checked against the user’s salon membership and permissions. Tenant-scoped database transactions keep application records tied to the selected salon. Platform administration is a separate role from salon ownership.",
              "Review team access when someone joins, changes role or leaves. Deactivate access that is no longer needed.",
            ],
            [
              "Passwords and sessions",
              "Passwords are stored as salted hashes. Session cookies are HTTP-only, and production traffic uses HTTPS. Password reset links are time-limited and single-use.",
              "Use a unique password and keep access to your account email secure. Do not share an owner login among the team.",
            ],
            [
              "Uploaded files",
              "Customer and location images use private storage. Customer photo uploads use short-lived signed URLs and are verified for expected size, content type and supported file signatures.",
              "Upload only images you have permission to store. Keep sensitive information out of general-purpose photo uploads.",
            ],
            [
              "Forms and links",
              "Intake links have expiry and allowed-use controls. Form answers can be reviewed in the salon workspace, linked to a customer when known.",
              "Choose the shortest practical link lifetime and collect only the answers you need. Avoid forwarding an individual customer’s link to another person.",
            ],
            [
              "Enquiries and email",
              "The website contact form stores the submitted enquiry for platform administrators and sends a notification to the configured owner address. It does not subscribe an enquirer to a marketing list.",
              "Do not include passwords, payment card details or private customer records in a contact message.",
            ],
            [
              "Questions before setup",
              "This page describes application controls. It is not a certification claim, a contractual security schedule or a promise of a particular data residency.",
              "Ask us about your requirements, data handling, retention and contractual terms before moving live customer records into the workspace.",
            ],
          ].map(([title, body, action], i) => (
            <section key={title}>
              <h2>{title}</h2>
              <div>
                <p>{body}</p>
                <p className="security-action">{action}</p>
              </div>
            </section>
          ))}
        </div>
        <ContactCTA
          title="Have a data-handling question?"
          text="Tell us the requirement you need to evaluate. Please leave sensitive customer information out of the enquiry."
        />
      </main>
      <SiteFooter />
    </>
  );
}
