# Etalier

Mobile-first salon business platform using Next.js App Router, Express, TypeScript and PostgreSQL. The earlier `../salon-studio` Sites prototype remains separate; it is not the local PostgreSQL app.

## Run locally

Use the repository-root [monorepo instructions](../README.md) and shared lockfile. The package in this directory is retained as a convenience wrapper for existing scripts; dependency installation happens at the repository root. Build the Dockerfile with the repository root as its context.

Node 22+ and PostgreSQL with pgcrypto/btree_gist are required. The supplied local database connection is in ignored `apps/api/.env`. Credentials are not tracked. Copy `.env.example` only for a new environment.

```powershell
npm ci
npm run db:migrate
npm run dev:api
# Another terminal:
npm run dev:web
```

Open http://localhost:3000. API: http://127.0.0.1:4000. Use the exact WEB_ORIGIN in your browser for origin validation. Existing admin and salon-owner accounts remain unchanged; credentials were provided in the chat. No passwords are recorded here.

Optional growth, engagement and stock modules are currently disabled globally; salon module controls are hidden. A platform administrator controls global feature availability. Salon owners control their tenant switches; dependencies and plan restrictions are enforced by APIs. Set employee working hours before booking. Stock consumption runs only while Inventory is enabled; insufficient stock then rolls back completion. Monetary values are stored in integer minor units and shown as prices in the interface.

Forms & responses combines reusable intake templates, a full-page builder and preview, customer answers, submission device details and link history. Creating a form generates a 24-hour single-use link. Share & send can create separate links for selected customers; copyable links allow at most 24 hours and emailed links at most 48 hours. Only salon owners can increase a link's submission limit. Links retain their original questions, and can be revoked or paused by archiving the form. Sending uses Resend immediately for the explicitly selected recipients; both email configuration and the Email module are required. Failed deliveries remain visible in link history. Public form viewers disclose the basic device metadata collected with each response.

Employee profiles contain contact details, locally stored photos, monthly performance, a monthly schedule, weekly working hours and quick leave entry. New employees require a name, email and phone number. Monthly base salaries are visible only with payroll access and editable with payroll-write access; setting a salary does not create a payroll payment. Working hours have moved out of the sidebar into each employee profile. Leave entries are shared with the main Leave screen; overlapping leave and conflicting bookings are rejected. Contribution cards are explicitly estimates using allocated service collections, the current base salary, accrued commissions and current consumable costs. Payroll records are displayed separately and allocated across overlapping months by calendar-day proportion.

Quick Work is the default home screen; Business overview remains at `/overview`. It records completed walk-in or returning-customer visits, not future appointments. Returning-customer search uses PostgreSQL trigram matching. Catalog prices are read server-side; custom service lines need a description and price. Enter the amount paid for services before tax and tip: any reduction from the listed price becomes a discount, then the configured salon tax and optional tip are added. Payments record money already received and do not charge payment networks. Tips are excluded from employee/service revenue attribution. Quick visits participate in customer, employee and service insights, stock consumption, commissions, invoices and today's visitor list. Idempotent saves prevent duplicate visits and payments. Platform admins configure each salon's allowed payment methods under Shops. Invoice email is optional and requires the Email module and Resend configuration; failed email does not undo the recorded visit.

## Integrations

Resend, Twilio, Cloudflare R2 and Stripe adapters use server environment variables listed in `apps/api/.env.example`. Integrations shows configuration presence, not a claim of successful provider verification. Keep R2 buckets private; allow PUT only from the configured application origin in R2 CORS. Signed uploads expire after 5 minutes and downloads after 2 minutes. Upload verification checks type, size and file signatures; a production malware quarantine is still outstanding.

Stripe webhook endpoint: `/api/v1/webhooks/stripe`, requiring STRIPE_WEBHOOK_SECRET and the raw signed body. Subscribe to checkout.session.completed and checkout.session.expired. Stripe success redirects do not mark an order paid; only a verified webhook can do so. Card entries under manual payment record a payment already taken elsewhere.

Notification workers are separate:

```powershell
npm run worker -w @atelier/api
```

Do not run workers with real sending credentials until workflows and recipients are intentionally configured. They send actual messages for queued jobs. Email retries use provider idempotency; ambiguous SMS failures require manual reconciliation rather than automatic resend. Provider crash recovery still needs production validation.

## API docs

Authenticated Swagger UI: http://127.0.0.1:4000/api/v1/docs (open through the frontend proxy at http://localhost:3000/api/v1/docs to share the cookie). JSON: `/api/v1/openapi.json`. Routes are collected from registered Express handlers; detailed request-schema coverage is incomplete and tracked in the roadmap.

## Validation

```powershell
npm run build
npm test
# From apps/api with a dedicated local test database and API running:
npx tsx --test tests/database.integration.ts
npx tsx --test tests/api.integration.ts
npx tsx --test tests/journey.integration.ts
```

The journey test creates its own temporary tenant and accounts, exercises booking races, consumption, checkout, payment replay/refund protections, form links and reporting, then removes its own records. Do not run destructive QA routines against real customer data.

Docker configuration is supplied but has not been exercised on this machine (Docker is unavailable). For Docker, configure an HTTPS reverse proxy, real WEB_ORIGIN, secure secrets and a PostgreSQL runtime role. Do not use the development postgres credentials in production.

See `docs/ROADMAP.md` for the current scope and explicit gaps, `docs/OPERATIONS.md` for security/deployment/backup guidance, and `docs/REQUIREMENTS.txt` for the full specification. This is a substantial local implementation, not a certification of production readiness.

Invoices include itemized charges, payments, refunds and downloadable PDFs. A walk-in can be saved as a customer directly from the invoice without creating a duplicate. Receipt delivery uses the backend Resend configuration and branded React Email templates. Website enquiries are stored in the platform admin Leads inbox and queued for owner notification. Locations are under Team & payroll, and the desktop sidebar can collapse to the Etalier star.

Analytics is under Front desk. Standalone POS & Orders, Payments and Expenses are globally paused through Sales management; the Quick Work ledger and invoice downloads remain available. Online payment checkout is also globally disabled. R2 uses the private etalier-media bucket with local-origin CORS; credentials belong only in the ignored server environment file.

Location details open from the Locations list and include monthly team activity, bookings and quick visits, outcomes, daily collections, tips and refunds. Collections use the salon timezone and show actual payments minus refunds. Employee, booking and financial details require their respective permissions; tenant and branch restrictions apply. Currency changes require explicit confirmation: all amounts are relabeled in the new currency without conversion, and the change is audited.

Analytics status rows expand into paginated appointment tables filtered by the same dates and permitted branch. Location listing includes active team size, monthly visits, net collections and thumbnails. Location photos are validated JPG/PNG/WebP uploads (2 MB maximum) stored in private R2; reads require location access. Profile cards have responsive spacing and the duplicate listing heading is hidden on location details.

Payroll schedules are configured in the employee Payroll tab: daily, weekly (7 days), biweekly (15 days), or calendar monthly. Base salary is always a monthly rate, prorated by calendar days. Schedules default to monthly starting on the migration/new employee date, so historical payroll is not backfilled without an explicit start-date change. The running API checks for missing drafts every minute; opening Payroll also catches up missed periods. Overlapping records are skipped, and concurrent generation is serialized per employee.

Drafts calculate accrued commission by its recorded date and deduct unpaid leave in proportion to missed scheduled working hours, using each month's daily salary rate in the salon timezone. Paid leave does not reduce salary; existing leave defaults to paid. Working hours must be configured before an unpaid-leave payroll can be marked paid. Draft details include commission entries, leave periods, daily deductions, the rate and formula used, bonuses, and required manual deduction reasons. Paid records keep their saved calculation. Recording paid is bookkeeping only and does not transfer money. Existing manual payroll records remain intact. Employee pickers in Leave and Payroll support search and photos.

Bookings is under Front desk and defaults to today in the salon timezone. Its paginated table combines scheduled appointments with completed Quick Work visits; use date ranges or All dates for history. The calendar requests the same Quick Work visits as completed entries at their logged time; these entries cannot be rescheduled or marked with a different status.

The shared booking form supports a full advance payment already received, using a salon-enabled manual payment method. Recording an advance requires finance-write access and creates a paid invoice including configured tax in the same transaction as the booking. It does not contact a payment network. Request keys make retries idempotent. Commission and stock consumption remain completion events; creating a prepaid booking does not accrue them, and completing it does not create a second invoice/payment. Public self-booking cannot claim an advance payment. Cancellation does not automatically issue a refund.

### European demo refresh

`npm run demo:europe -w @atelier/api` previews Maison Élan without connecting to the database or downloading anything. It writes `.qa/europe-demo-preview.json`. Run `npm run demo:europe -w @atelier/api -- --apply` to refresh only the local salon explicitly marked `syntheticDataOnly` in `.qa/qa-access.json`. Existing login credentials and memberships are retained. It validates and caches the selected Unsplash photos before data changes, writes a tenant-data backup under ignored `backups/`, then replaces the synthetic records atomically. Other salons and global module availability are untouched. Images are copied into private R2 or the existing image tables; stock photo credits are written under `.qa/`. The people, business, contact details, device details, and transactions are fictional demo data. No messages, payment-provider calls, or actual payroll payments are sent.

Salon Settings is arranged into inline profile, contact, booking, regional, appearance and security cards with independent save buttons. Collapsed desktop navigation retains an icon for every available destination, with accessible hover/focus labels.
