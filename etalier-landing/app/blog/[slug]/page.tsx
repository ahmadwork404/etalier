import { notFound } from "next/navigation";
import { articles, articleBySlug } from "@/lib/journal";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { Icon } from "@/components/Icons";
import { pageMetadata, siteOrigin, breadcrumb } from "@/lib/seo";
import { StructuredData } from "@/components/StructuredData";
export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const a = articleBySlug((await params).slug);
  return a
    ? pageMetadata({
        title: a.title + " | Etalier Journal",
        description: a.summary,
        path: "/blog/" + a.slug,
        type: "article",
      })
    : {};
}
export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const a = articleBySlug((await params).slug);
  if (!a) notFound();
  const published = a.publishedAt || "2026-11-14";
  const modified = a.modifiedAt || published;
  return (
    <>
      <SiteHeader />
      <main id="main">
        <StructuredData
          data={{
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "@id": siteOrigin + "/blog/" + a.slug + "#article",
            headline: a.title,
            description: a.summary,
            url: siteOrigin + "/blog/" + a.slug,
            mainEntityOfPage: {
              "@type": "WebPage",
              "@id": siteOrigin + "/blog/" + a.slug,
            },
            datePublished: published + "T00:00:00+05:00",
            dateModified: modified + "T00:00:00+05:00",
            author: {
              "@type": "Organization",
              name: "Etalier",
              url: siteOrigin + "/about",
            },
            publisher: { "@id": siteOrigin + "/#organization" },
            image: siteOrigin + "/social.png",
            inLanguage: "en",
            articleSection: a.category,
          }}
        />
        <StructuredData
          data={breadcrumb([
            { name: "Home", path: "/" },
            { name: "Journal", path: "/blog" },
            { name: a.title, path: "/blog/" + a.slug },
          ])}
        />
        <article>
          <header className="article-hero">
            <a className="breadcrumb" href="/blog">
              ← The salon journal
            </a>

            <h1>{a.title}</h1>
            <p>{a.summary}</p>
            <div className="article-byline">
              Etalier editorial ·{" "}
              <time dateTime={published}>
                {new Date(published + "T12:00:00Z").toLocaleDateString(
                  "en-GB",
                  {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  },
                )}
              </time>
            </div>
          </header>
          <div className="article-layout">
            <aside className="article-toc">
              <strong>In this guide</strong>
              <nav aria-label="Article contents">
                {a.sections.map((s) => (
                  <a key={s.id} href={"#" + s.id}>
                    {s.title}
                  </a>
                ))}
              </nav>
              <a className="toc-contact" href="/contact">
                Discuss your workflow ↗
              </a>
            </aside>
            <div className="article-body">
              {a.sections.map((s) => (
                <section id={s.id} key={s.id}>
                  <h2>{s.title}</h2>
                  {s.paragraphs.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                  {s.list && (
                    <ul>
                      {s.list.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
              {a.sources && (
                <section className="article-sources">
                  <h2>Sources and further reading</h2>
                  <ul>
                    {a.sources.map((source) => (
                      <li key={source.url}>
                        <a
                          href={source.url}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {source.title} ↗
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <div className={"article-takeaway tone-" + a.tone}>
                <p>{a.takeaway}</p>
              </div>
              <div className="article-end">
                <p>Want to see how this works in Etalier?</p>
                <a className="button yellow" href="/contact">
                  Arrange a walkthrough <Icon name="arrow" />
                </a>
              </div>
            </div>
          </div>
        </article>
        <section className="editorial-section">
          <div className="related-articles">
            {articles
              .filter((x) => x.slug !== a.slug)
              .slice(0, 2)
              .map((x) => (
                <a key={x.slug} href={"/blog/" + x.slug}>
                  <h3>{x.title}</h3>
                  <span className="card-link">
                    Read the guide <Icon name="arrow" />
                  </span>
                </a>
              ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
