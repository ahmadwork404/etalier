import { articles } from "@/lib/journal";
import { SiteHeader, SiteFooter, ContactCTA } from "@/components/SiteChrome";
import { Icon, Star } from "@/components/Icons";
export const metadata = {
  title: "The Salon Journal — Etalier",
  description:
    "Practical guides to closing the day, managing bookings, customer consultations and payroll review.",
  alternates: { canonical: "/blog" },
};
export default function BlogPage() {
  const [lead, ...rest] = articles;
  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="journal-hero">
          <div>
            <span className="eyebrow">THE SALON JOURNAL</span>
            <h1>
              A little perspective.
              <br />
              <em>A useful next step.</em>
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
              <span className="eyebrow">THE END-OF-DAY EDIT</span>
              <div className="journal-paper">
                <span>SERVICE €65</span>
                <span>DISCOUNT −€5</span>
                <span>TIP +€4</span>
                <strong>A day that adds up.</strong>
              </div>
              <Star />
            </div>
            <div>
              <span className="article-meta">
                {lead.category} / {lead.readTime}
              </span>
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
                  <span>FIELD NOTES / 0{i + 2}</span>
                  <strong>
                    {
                      ["Make room.", "Know the person.", "Check the details."][
                        i
                      ]
                    }
                  </strong>
                  <Star />
                </div>
                <span className="article-meta">
                  {a.category} / {a.readTime}
                </span>
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
