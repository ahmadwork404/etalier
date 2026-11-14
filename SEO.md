# Public website SEO

The indexable website is `https://etalier.app`. The CRM and workers.dev previews are excluded from indexing. `www.etalier.app` redirects permanently to the apex domain. Do not redirect the preview hostname while it is needed as a DNS fallback.

Implemented controls:

- Unique page titles and descriptions, absolute canonical URLs and page-specific Open Graph/Twitter metadata.
- Organization and WebSite JSON-LD, BlogPosting markup on articles, and breadcrumb markup on article and feature pages. No invented ratings, prices or certifications.
- `/robots.txt`, `/sitemap.xml`, real article publication dates, and modification dates only where known. `/robot.txt` redirects to the standard filename.
- Permanent normalization of trailing slashes; unknown pages return 404.
- CRM `noindex, nofollow` response headers and metadata, with crawler disallow rules. Preview website responses are noindex and its robots file disallows crawling.
- Server-rendered article text, descriptive internal links, readable article navigation and responsive pages.
- `/blogs` is the journal's canonical route. Old `/blog` URLs redirect permanently, preserving article paths and query parameters.
- `/llm.txt` and `/llms.txt` provide the same public product overview and guide index. Articles and feature pages offer clean `index.md` versions with canonical headers; private CRM records are never included.

## Research and editorial plan

Reviewed on 15 November 2026. These are topic ideas based on published industry guidance and the product's actual workflows, not keyword-volume estimates.

| Topic | Reader's task | Status | Research |
| --- | --- | --- | --- |
| Salon cancellation policy | Explain notice periods, cancellation routes and exceptions clearly | Published | [NHBF policy resource](https://www.nhbf.co.uk/nhf-shop/230112773-no-shows-late-cancellations-policy/) |
| Salon rebooking rate | Define the denominator and distinguish reservations from completed returns | Published | [Fresha retention guidance](https://www.fresha.com/blog/4-simple-salon-client-retention-strategies) |
| Google Business Profile booking links | Test the destination and correct salon location | Published | [Google link instructions](https://support.google.com/business/answer/6218037?hl=en), [Google link guidelines](https://support.google.com/business/answer/13769188?hl=en) |
| Appointment reminders | Write confirmation and reminder messages without making unsupported automation claims | Future idea | [Fresha appointment updates](https://www.fresha.com/help-center/knowledge-base/calendar/130-send-appointment-updates) |
| Service-menu price changes | Explain what's included and keep existing booking prices understandable | Future idea | [NHBF Code of Practice](https://www.nhbf.co.uk/documents/salons-and-barbershops-code-of-practice/2salons-and-barbershops-code-of-practice.pdf) |
| Customer records before migration | Deduplicate people and decide what information is necessary | Future idea | Requires additional privacy and migration research before publication |

The three researched articles use original examples and operational checklists. Sources are visible on the article pages. The journal also includes the four existing original guides on end-of-day reconciliation, buffers, consultations and payroll review. New articles are maintained in `etalier-landing/lib/researched-journal.ts`.

SEO implementation references: [Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) and [Google Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article).

## Search Console

Ownership verification and sitemap submission require the site owner's Google Search Console account. No verification token has been supplied or fabricated. Once verified, submit `https://etalier.app/sitemap.xml` and inspect the homepage and a journal URL. Sitemap availability and valid markup do not establish that Google has indexed a page or guarantee a ranking.
