import { articles, articleBySlug } from "./journal";
import { features, featureBySlug } from "./product";
import { siteOrigin } from "./seo";
export function llmsText() {
  return `# Etalier

> Etalier is salon management software for bookings, walk-ins, customer records, team schedules and payroll records.

The public website is https://etalier.app. The private CRM is https://portal.etalier.app and requires an authorised account. Do not treat the illustrative workspace, fictional customers or example amounts as customer results. Pricing and setup are discussed directly; there is no public self-service checkout. Payment recording does not initiate a card charge or a salary transfer.

## Product

- [Product overview](${siteOrigin}/product): Connected salon workflows and an illustrative interactive preview.
${features.map((f) => `- [${f.tag}](${siteOrigin}/features/${f.slug}/index.md): ${f.description}`).join("\n")}

## Salon guides

${articles.map((a) => `- [${a.title}](${siteOrigin}/blogs/${a.slug}/index.md): ${a.summary}`).join("\n")}

## Company and setup

- [About Etalier](${siteOrigin}/about): Product purpose and working principles.
- [Setup and pricing enquiries](${siteOrigin}/pricing): What to discuss before choosing a setup.
- [Security and data](${siteOrigin}/security): Application controls, data handling and limits.
- [Contact](${siteOrigin}/contact): Request a walkthrough or ask a product question.

## Optional

- [Journal](${siteOrigin}/blogs): All public salon guides.
- [Sitemap](${siteOrigin}/sitemap.xml): Canonical public website URLs.
`;
}
export function markdownResponse(body: string, canonical: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-Robots-Tag": "noindex, follow",
      Link: `<${canonical}>; rel="canonical", <${siteOrigin}/llms.txt>; rel="describedby"`,
    },
  });
}
export function articleMarkdown(slug: string) {
  const a = articleBySlug(slug);
  if (!a) return null;
  return `# ${a.title}\n\n${a.summary}\n\nPublished: ${a.publishedAt || "2026-11-14"}\nAuthor: Etalier editorial\nCanonical: ${siteOrigin}/blogs/${a.slug}\n\n${a.sections.map((s) => `## ${s.title}\n\n${s.paragraphs.join("\n\n")}${s.list ? "\n\n" + s.list.map((x) => "- " + x).join("\n") : ""}`).join("\n\n")}\n\n${a.takeaway}\n${a.sources ? "\n## Sources\n\n" + a.sources.map((s) => `- [${s.title}](${s.url})`).join("\n") : ""}\n`;
}
export function featureMarkdown(slug: string) {
  const f = featureBySlug(slug);
  if (!f) return null;
  return `# ${f.title}\n\n${f.intro}\n\nCanonical: ${siteOrigin}/features/${f.slug}\n\n${f.steps.map(([h, p]) => `## ${h}\n\n${p}`).join("\n\n")}\n\n## ${f.detailTitle}\n\n${f.details.map((s) => "- " + s).join("\n")}\n\n${f.boundary}\n`;
}
