import { notFound } from "next/navigation";
import { articles, articleBySlug } from "@/lib/journal";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { Icon } from "@/components/Icons";
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
    ? {
        title: a.title + " — Etalier Journal",
        description: a.summary,
        alternates: { canonical: "/blog/" + a.slug },
        openGraph: { type: "article", title: a.title, description: a.summary },
      }
    : {};
}
export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const a = articleBySlug((await params).slug);
  if (!a) notFound();
  return (
    <>
      <SiteHeader />
      <main id="main">
        <article>
          <header className="article-hero">
            <a className="breadcrumb" href="/blog">
              ← The salon journal
            </a>
            <span className="article-meta">
              {a.category} / {a.readTime}
            </span>
            <h1>{a.title}</h1>
            <p>{a.summary}</p>
            <div className="article-byline">
              Etalier editorial ·{" "}
              <time dateTime="2026-11-14">14 November 2026</time>
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
              <div className={"article-takeaway tone-" + a.tone}>
                <span className="eyebrow">TAKE THIS INTO TOMORROW</span>
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
          <span className="eyebrow">KEEP READING</span>
          <div className="related-articles">
            {articles
              .filter((x) => x.slug !== a.slug)
              .slice(0, 2)
              .map((x) => (
                <a key={x.slug} href={"/blog/" + x.slug}>
                  <span className="article-meta">{x.category}</span>
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
