import { pageMetadata } from "@/lib/seo";
import { articles } from "@/lib/journal";
import { SiteHeader, SiteFooter, ContactCTA } from "@/components/SiteChrome";
import { Icon, Star } from "@/components/Icons";
export const metadata = pageMetadata({
  title: "Salon Management Guides & Advice | Etalier Journal",
  description:
    "Practical salon guides on bookings, cancellations, customer consultations, rebooking, cash reconciliation and payroll review.",
  path: "/blog",
});
export default function BlogPage() {
  const [lead, ...rest] = articles;
  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="journal-hero">
          <div>
            <h1>
              Practical advice.
              <br />
              <em>For your salon.</em>
            </h1>
          </div>
          <p>
            Practical notes for the business behind the chair. Take one idea
            into your next working day.
          </p>
        </section>
        <section className="journal-content">
          <a className="journal-feature" href={"/blog/" + lead.slug}>
            <div className="journal-art tone-peach">
              <div className="journal-paper">
                <strong>Clear cancellation terms.</strong>
              </div>
              <Star />
            </div>
            <div>
              <h2>{lead.title}</h2>
              <p>{lead.summary}</p>
              <span className="card-link">
                Read the guide <Icon name="arrow" />
              </span>
            </div>
          </a>
          <div className="journal-grid">
            {rest.map((a, i) => (
              <a className="journal-card" key={a.slug} href={"/blog/" + a.slug}>
                <div className={"journal-card-art tone-" + a.tone}>
                  <strong>{a.category}</strong>
                  <Star />
                </div>

                <h2>{a.title}</h2>
                <p>{a.summary}</p>
                <span className="card-link">
                  Read the guide <Icon name="arrow" />
                </span>
              </a>
            ))}
          </div>
        </section>
        <ContactCTA title="Put a clearer process to work." />
      </main>
      <SiteFooter />
    </>
  );
}
