import { pageMetadata } from "@/lib/seo";
import { SiteHeader, SiteFooter, ContactCTA } from "@/components/SiteChrome";
import { ProductPreview } from "@/components/ProductPreview";
import { features } from "@/lib/product";
import { Icon } from "@/components/Icons";
export const metadata = pageMetadata({
  title: "Salon Management Software & Features | Etalier",
  description:
    "Explore salon bookings, walk-ins, customer profiles, intake forms, working hours and payroll in Etalier.",
  path: "/product",
});
export default function ProductPage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="editorial-hero centered">
          <h1>
            The whole salon.
            <br />
            <em>One working picture.</em>
          </h1>
          <p>
            From the first booking to the last receipt, keep the work connected
            to the customer, the team and the numbers.
          </p>
          <a className="button yellow" href="/contact">
            Walk through it with us <Icon name="arrow" />
          </a>
        </section>
        <section className="product-demo-section">
          <ProductPreview />
        </section>
        <section className="editorial-section">
          <div className="section-heading">
            <h2>Four parts of a better-run day.</h2>
          </div>
          <div className="product-page-grid">
            {features.map((f) => (
              <a
                href={"/features/" + f.slug}
                className={"product-page-card tone-" + f.tone}
                key={f.slug}
              >
                <h3>{f.title}</h3>
                <p>{f.description}</p>
                <span className="card-link">
                  Explore {f.tag.toLowerCase()} <Icon name="arrow" />
                </span>
              </a>
            ))}
          </div>
        </section>
        <section className="connected-strip">
          <h2>A visit should not need entering three times.</h2>
          <div>
            <p>
              <strong>At the desk</strong>Record the customer, services,
              employee and payment in one visit.
            </p>
            <p>
              <strong>In the record</strong>Find the visit against the customer
              and the invoice it produced.
            </p>
            <p>
              <strong>In the review</strong>Use appointments, payment records
              and team reporting to understand the day.
            </p>
          </div>
        </section>
        <ContactCTA />
      </main>
      <SiteFooter />
    </>
  );
}
