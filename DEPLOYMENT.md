# Etalier domains and deployment

Create two Vercel projects from this repository:

| Project | Root directory | Domain | Environment |
| --- | --- | --- | --- |
| Landing | `etalier-landing` | `etalier.app` | `NEXT_PUBLIC_APP_URL=https://portal.etalier.app`, `NEXT_PUBLIC_SITE_URL=https://etalier.app`, `BACKEND_API_URL=<HTTPS backend origin>` |
| CRM | `atelier-platform/apps/web` | `portal.etalier.app` | `API_INTERNAL_URL=<HTTPS backend origin>` |

Both projects use the Next.js preset and normal Next.js output. Enable access to files outside each project's root directory so Vercel can install the npm workspaces using the repository-root `package-lock.json`. Set Node.js 22 and use `npm ci` from the repository root for installation. Build the landing with `npm run build --workspace etalier-landing` and the portal with `npm run build --workspace @atelier/web` from the repository root (or each project's normal `npm run build` with its Vercel root selected). Rebuild the CRM after changing `API_INTERNAL_URL`, because its API rewrite is resolved at build time.

The backend host has not been selected. Run the long-lived API and its background notification scheduler on a Node.js service, not as frontend serverless functions. It needs persistent PostgreSQL and the existing R2 configuration. Set `HOST=0.0.0.0` and the host's assigned `PORT`, run migrations before startup, then run `npm run start -w @atelier/api` after building. Preserve all database and storage secrets on the backend only.

Backend production environment:

```dotenv
NODE_ENV=production
PUBLIC_APP_URL=https://portal.etalier.app
PUBLIC_SITE_URL=https://etalier.app
WEB_ORIGIN=https://portal.etalier.app
WEB_ORIGINS=https://etalier.app,https://portal.etalier.app
RESEND_FROM=Etalier <notifications@etalier.app>
LEAD_NOTIFICATION_TO=ahmadshaukat328@gmail.com
RESEND_API_KEY=<domain-scoped sending key from the local backend environment>
```

Copy the local backend's Resend credential through your host's secret manager. Never put it in a `NEXT_PUBLIC_` variable or commit `.env`. Local development additionally allows the two localhost frontend ports; production does not automatically allow localhost or arbitrary Vercel preview domains. Add a specific trusted preview origin to both the backend `WEB_ORIGINS` and landing `SITE_ORIGIN` only if required.

CRM requests go through the CRM's `/api` rewrite. Session cookies stay HTTP-only and scoped to the portal host; there is no shared landing-page session cookie. The landing `/api/contact` route forwards only the contact payload, not CRM cookies, to the backend. Both CORS and write-request origin checks allow the two production origins.

## Leads and email

The public contact page is `/contact`. Enquiries are saved in `contact_leads`, and only platform super administrators can access `/admin/leads`. Owners of individual salons cannot access this inbox. Each enquiry has a follow-up status, private notes and notification delivery state. Notification emails go to the fixed backend recipient; replying addresses the enquirer. A submitted form does not subscribe anyone to marketing or send an automatic email to an unverified address.

The API checks pending lead notifications every 30 seconds. Failed sends retry with backoff up to five attempts. Persistent failures remain visible and can be retried by an administrator. Do not run multiple API instances without shared PostgreSQL; database claims prevent simultaneous processing of the same lead. Submission UUIDs prevent duplicate enquiries on network retries.

React Email templates live in `apps/api/src/services/email-templates.tsx` and generate HTML plus a text alternative. They cover account verification, resets, team invitations, intake forms, invoices and lead notifications. Existing disabled marketing and engagement modules remain disabled. Setting up a sending address does not create a mailbox at that address.

Six rendered reference templates are also published in Resend under the `etalier-` aliases (password reset uses `etalier-password-reset-v1`). The application renders the versioned local React templates directly; editing a dashboard reference does not change the application. Generate local HTML previews with `npx tsx apps/api/scripts/render-email-previews.ts` from the workspace root. The generated previews stay in ignored `.qa/email-previews`.

Before launch, set both backend origin variables in Vercel, apply database migrations, check a contact submission from the live domain and confirm the notification's delivery. DNS and frontend publication are not performed by these source changes.
