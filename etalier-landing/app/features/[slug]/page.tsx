import { notFound } from "next/navigation";
import { features, featureBySlug } from "@/lib/product";
import { articleBySlug } from "@/lib/journal";
import { SiteHeader, SiteFooter, ContactCTA } from "@/components/SiteChrome";
import { WorkflowVisual } from "@/components/WorkflowVisual";
import { Icon } from "@/components/Icons";
export function generateStaticParams() {
  return features.map((f) => ({ slug: f.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const f = featureBySlug((await params).slug);
  return f
    ? {
        title: f.tag + " — Etalier",
        description: f.description,
        alternates: { canonical: "/features/" + f.slug },
      }
    : {};
}
export default async function FeaturePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const f = featureBySlug((await params).slug);
  if (!f) notFound();
  const article = articleBySlug(f.article);
  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="feature-page-hero">
          <div>
            <a href="/product" className="breadcrumb">
              Product / {f.tag.toLowerCase()}
            </a>
            <h1>{f.title}</h1>
            <p>{f.intro}</p>
            <a href="/contact" className="button yellow">
              See it in a walkthrough <Icon name="arrow" />
            </a>
          </div>
          <WorkflowVisual kind={f.slug} />
        </section>
        <section className="editorial-section">
          <div className="section-heading">
            <span className="eyebrow">HOW IT WORKS</span>
            <h2>
              Clear steps.
              <br />
              Useful records.
            </h2>
          </div>
          <div className="workflow-steps">
            {f.steps.map(([title, text], i) => (
              <article key={title}>
                <span>0{i + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="feature-detail-band">
          <div>
            <span className="eyebrow">THE DETAILS MATTER</span>
            <h2>{f.detailTitle}</h2>
          </div>
          <div>
            <ul>
              {f.details.map((d) => (
                <li key={d}>
                  <Icon name="check" />
                  {d}
                </li>
              ))}
            </ul>
            <p className="honest-note">{f.boundary}</p>
          </div>
        </section>
        {article && (
          <a className="related-feature-article" href={"/blog/" + article.slug}>
            <span className="eyebrow">FROM THE SALON JOURNAL</span>
            <h3>{article.title}</h3>
            <p>{article.summary}</p>
            <span className="card-link">
              Read the guide <Icon name="arrow" />
            </span>
          </a>
        )}
        <ContactCTA />
      </main>
      <SiteFooter />
    </>
  );
}
