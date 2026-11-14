import { pageMetadata } from "@/lib/seo";
import { SiteHeader, SiteFooter, ContactCTA } from "@/components/SiteChrome";
import { Icon } from "@/components/Icons";
export const metadata = pageMetadata({
  title: "Salon Software for US$10/month | One Month Free | Etalier",
  description:
    "Try Etalier salon management software free for one month, then continue for US$10 per month. Contact us to arrange trial access.",
  path: "/pricing",
});
export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="editorial-hero centered">
          <h1>
            Your first month is free.
            <br />
            <em>Then US$10/month.</em>
          </h1>
          <p>
            Try Etalier for one month, then continue for US$10 per month. Tell
            us about your salon and we’ll arrange your trial access and setup.
          </p>
          <a className="button yellow" href="/contact">
            Start your free month <Icon name="arrow" />
          </a>
        </section>
        <section className="setup-grid editorial-section">
          <article className="setup-card tone-butter">
            <h2>A few details help.</h2>
            <ul>
              <li>How many people and locations you manage.</li>
              <li>How appointments and walk-ins arrive today.</li>
              <li>Which customer records you need to bring over.</li>
              <li>How you review commission and payroll.</li>
              <li>Which existing tools you need to keep.</li>
            </ul>
            <p>
              You do not need to send private customer information to explain
              your workflow.
            </p>
          </article>
          <article className="setup-card">
            <h2>Check the actual workflow.</h2>
            <p>
              Use a walkthrough to follow a real example from booking to payment
              record. Ask about the parts that matter to your salon rather than
              working through a generic feature list.
            </p>
            <p>
              Confirm the price, included functionality, location allowance and
              setup arrangements directly before proceeding. There is no
              self-service checkout on this website.
            </p>
            <a className="card-link" href="/product">
              Explore the product first <Icon name="arrow" />
            </a>
          </article>
        </section>
        <section className="editorial-section setup-faq">
          <h2>Know what you’re setting up.</h2>
          {[
            [
              "Can we see it before deciding?",
              "Yes. Use the contact form to ask for a walkthrough and describe your team. The product overview also includes an illustrative interactive workspace.",
            ],
            [
              "Can we bring existing records?",
              "Tell us what you have and which format it is in. Import scope and any cleanup need to be agreed before setup; do not assume an automatic migration from every system.",
            ],
            [
              "Do payment records charge customers?",
              "No. Recording received money, including advance payments, does not initiate a card charge or a bank transfer.",
            ],
            [
              "What should we configure first?",
              "Start with the salon currency and timezone, locations, employees and working hours, then services and customer records. Check a sample booking and invoice before the team uses it for a live day.",
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <Icon name="plus" />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </section>
        <ContactCTA title="Bring the questions that matter." />
      </main>
      <SiteFooter />
    </>
  );
}
