import { pageMetadata } from "@/lib/seo";
import { SiteHeader, SiteFooter, ContactCTA } from "@/components/SiteChrome";
import { Star } from "@/components/Icons";
export const metadata = pageMetadata({
  title: "About Etalier | Salon Management Software",
  description:
    "Learn how Etalier connects salon bookings, customer records, payments and team operations in one practical workspace.",
  path: "/about",
});
export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="about-hero">
          <h1>
            There’s a whole
            <br />
            business behind
            <br />
            <em>the chair.</em>
          </h1>
          <div className="about-margin-note">
            <Star />
            <p>
              The craft is personal.
              <br />
              The admin should
              <br />
              make room for it.
            </p>
          </div>
        </section>
        <section className="about-story">
          <div>
            <h2>A clearer place for the work that surrounds the work.</h2>
            <p>
              A salon’s day moves between conversations and decisions: who is
              coming in, who has time, what the customer asked for, what they
              paid, and what the team is owed.
            </p>
            <p>
              Etalier brings those records together. A visit connects to a
              person, a service, an employee and an invoice. The aim is
              straightforward: make it easier to see what happened and decide
              what to do next.
            </p>
            <p>
              We build around practical work at the front desk and the owner’s
              review afterwards. A quick walk-in should be quick to enter. A
              payroll draft should be possible to inspect. A customer’s answers
              should be readable where the team needs them.
            </p>
          </div>
        </section>
        <section className="editorial-section">
          <div className="section-heading">
            <h2>Useful is a design decision.</h2>
          </div>
          <div className="principle-grid">
            {[
              [
                "01",
                "Keep the connections.",
                "Bookings, customer history and payments should describe the same visit. Connected records reduce the need to reconstruct a day from separate lists.",
              ],
              [
                "02",
                "Show the reason.",
                "A discount, a cancellation and a payroll deduction mean different things. Keep the difference visible instead of compressing everything into a total.",
              ],
              [
                "03",
                "Leave the owner in control.",
                "Draft payroll needs review. Payment recording should say what it does. Configuration and access should reflect the team that actually uses the workspace.",
              ],
            ].map(([n, h, p]) => (
              <article key={n}>
                <span>{n}</span>
                <h3>{h}</h3>
                <p>{p}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="about-invitation">
          <h2>
            Show us the part
            <br />
            of your day that’s messy.
          </h2>
          <p>
            Tell us how bookings arrive, how walk-ins are handled and how the
            team is paid. We can walk through what Etalier covers and be clear
            about what still belongs in your existing process.
          </p>
          <a href="/contact" className="text-action">
            Talk to us ↗
          </a>
        </section>
        <ContactCTA title="Let’s start with your salon." />
      </main>
      <SiteFooter />
    </>
  );
}
