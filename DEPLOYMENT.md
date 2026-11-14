# Etalier deployment

The platform runs as three Cloudflare Workers in this npm monorepo.

| Application | URL | Source |
| --- | --- | --- |
| Public website | https://etalier.app | `etalier-landing` |
| CRM and platform admin | https://portal.etalier.app | `atelier-platform/apps/web` |
| API health | https://etalier-api.etalier-ahmadwork404.workers.dev/api/v1/health | `atelier-platform/apps/api` |

The frontend Workers use vinext and Workers Static Assets. Their server routes call the API through a Cloudflare service binding. CRM cookies remain HTTP-only and scoped to the portal. The landing contact endpoint does not forward CRM cookies.

The Express API runs through Cloudflare's Node HTTP adapter. Supabase PostgreSQL connects through the `etalier-postgres` Hyperdrive binding, with query caching disabled and a restricted `etalier_app` runtime role. Tenant transactions set PostgreSQL tenant context. Supabase public REST roles cannot access application tables. Supabase API keys are not database passwords or the app's authentication mechanism.

## Build and deploy

Use a current supported Node release. Cloudflare CLI requires at least 22.23, 24.22 or 26.12 in the corresponding release line.

```bash
npm ci
npm test
npm run build:cloudflare
npm run typecheck
```

Worker builds generate ignored binding types under each application's `.cloudflare/types` directory. CI builds before typechecking for that reason. Standard local Node/Next development remains available through the root `dev:*` scripts.

Each app has a `cloudflare.config.ts`; shared non-secret settings are in `cloudflare/settings.mjs`. Frontend configurations declare the production domains so subsequent deployments preserve them. The backend permits both production origins.

Supply `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` through the environment or ignored root `.env.cloudflare-deploy`. This project uses the `cf` CLI.

```bash
node scripts/cf.mjs api deploy --prebuilt
node scripts/cf.mjs portal deploy --prebuilt
node scripts/cf.mjs landing deploy --prebuilt
```

Configure declared Resend, R2 and Supabase secrets through Cloudflare's secret manager. The CLI also accepts `--secrets-file` pointing to an ignored JSON object. Never commit that file. The API's database connection comes from Hyperdrive; no privileged database password is deployed in its environment.

Local backend settings are in ignored `atelier-platform/apps/api/.env`; `.env.cloudflare` beside it contains production connection settings. Frontend `.env.local` files contain public settings. Production URLs are `NEXT_PUBLIC_APP_URL=https://portal.etalier.app` and `NEXT_PUBLIC_SITE_URL=https://etalier.app`. Service bindings replace `API_INTERNAL_URL` and `BACKEND_API_URL` in Workers; those variables remain available for local Node hosting.

## Database and jobs

The initial 22 SQL migrations are applied. Run future migrations through a trusted direct database connection as the migration owner before deploying dependent code. `SUPABASE_SETUP.sql` is an initial setup reference with a password placeholder; do not rerun it against an initialized database. The temporary provisioning Worker has been removed.

A per-minute scheduled trigger processes queued lead emails and payroll generation. Jobs use PostgreSQL claims, retries and persistent state. Native Node development retains its existing timers. Workers use Web Crypto PBKDF2 password hashes. Legacy native Argon2 accounts migrated from another database must use password reset.

## Leads, email and uploads

The landing `/contact` page saves enquiries to PostgreSQL. Platform administrators see them at `/admin/leads`; salon owners cannot access this inbox. Notifications go to the configured owner address, with the enquirer's address as Reply-To. Failed deliveries retry with backoff and remain visible to administrators.

React Email templates in `atelier-platform/apps/api/src/services/email-templates.tsx` render HTML and plain text for verification, resets, invitations, intake forms, invoices and lead notifications. Published Resend templates are references; the application renders its versioned local templates. Password setup uses the single-use, 30-minute reset flow.

R2 stores location and customer images. Browser uploads use short-lived signed URLs followed by server verification of size, MIME type and file signature. Bucket CORS permits the production portal and landing origins. Employee and service thumbnails use authenticated image endpoints.

The labelled Maison Linden demo salon contains fictional European customers, employees, services, bookings and recorded sales. Demo customer emails use `example.test`; seeding sends them no messages. Photo credits and source links are retained in `atelier-platform/apps/api/scripts/europe-demo-plan.ts`.

## Custom-domain DNS fallback

If a network resolver cannot resolve the domains, use https://etalier-landing.etalier-ahmadwork404.workers.dev for the website and https://etalier-portal.etalier-ahmadwork404.workers.dev for the CRM. Compare the failing resolver with public DNS before changing Cloudflare records. Both workers.dev routes remain enabled alongside the custom domains. Their origins are explicitly allowed by the API and R2 CORS. The website uses the fallback CRM login link when opened on its workers.dev hostname. Preview responses are excluded from search indexing.

The website includes a product overview, four feature pages, About, a journal with seven guides, setup/pricing enquiries, security information, contact, sitemap and robots metadata. Article content is maintained in `etalier-landing/lib/journal.ts` and `researched-journal.ts`. See `SEO.md` for indexing controls and source research.
