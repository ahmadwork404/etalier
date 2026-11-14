# Atelier implementation status

The original requirements are preserved in `REQUIREMENTS.txt`. This checklist distinguishes implemented local workflows from externally verified production capability. Mobile-first layouts apply throughout.

## Implemented and locally exercised

- Next.js/React/TypeScript frontend, Express modules, PostgreSQL migrations, tenant-scoped queries and RLS.
- Argon2id credentials, HttpOnly sessions, session rotation/revocation, password change, custom role creation, membership assignment, global/tenant/plan/dependency feature checks.
- Tenant creation/switching, branches, business currency/timezone/booking/tax settings, admin suspension and global feature controls.
- Customer directories and editing, tags/preferences, consent history, appointment history; employee/service editing.
- Employee working days and leave, multi-service bookings, employee/branch filters, day/week/month views and desktop drag rescheduling.
- Database exclusion constraints plus employee locking for booking concurrency; completion consumes configured products and records commission.
- Products, suppliers, stock movements/transfers, purchase-order API and idempotent goods receipt, service consumption rules.
- Orders, discounts, configured taxes, retail stock deduction, partial manual payments, refunds, gift-card/loyalty ledgers and prepaid membership credits.
- Stored-data revenue reports, audit trails, request validation, rate limiting, origin checks and secure headers.
- Intake form templates/submissions, purpose-scoped customer links, review submissions, UGC consent/moderation and private-media adapter.
- Workflow/campaign queues, consent suppression, feature rechecks at execution and delivery history.
- Public booking page, customer history/preferences portal, invitation acceptance, password-reset/verification pages.

## Implemented adapters; external credentials required

Resend email, Twilio SMS/WhatsApp, Cloudflare R2 private upload/download and Stripe Checkout/signature-verified webhooks. No live delivery, upload, charge or refund has been performed by development tests. Provider status is visible in Integrations. Set the variables in `apps/api/.env.example` using server-side secrets, configure R2 CORS, verified sender identity, Twilio sending numbers, and Stripe webhook routing. Start workers only after sender/consent policies are reviewed.

## Outstanding before the full specification can be called complete

- Complete schema-level OpenAPI coverage (the live Swagger catalogue covers all registered paths but detailed request schemas currently cover core operations).
- Optional MFA,  persistent distributed brute-force protection, auth failure auditing, and a dedicated non-superuser runtime deployment.
- Service-specific commission variants, resource calendars, richer shift breaks/holidays, employee-service assignments/pricing variations, deposits and package/gift-card financial reconciliation. Basic payroll recording is implemented with separate permissions.
- Tenant logo uploads, customizable subscription billing/limits, complete platform user/maintenance/provider administration, and AI assistant.
- Automated configurable retention schedules, production malware quarantine/scanning and video security review. Owner-mediated privacy export/deletion requests and self-service UGC withdrawal are implemented; R2-backed deletion still needs provider verification.
- Public booking slot picker with salon-local timezone input, public deposits and intake-service attachment rules; full customer booking portal polish. Portal rescheduling and cancellation now enforce the configured window.
- Automatic review/UGC invitation workflows and per-channel consent granularity; complete campaign segmentation; recurring memberships and renewal billing.
- Purchase-order, role-edit, membership-redemption and advanced multi-line POS interfaces; complete staff-facing role dashboards and accessibility focus management.
- Recovery leases/reconciliation for uncertain provider delivery; Twilio jobs are not automatically retried after ambiguous failures, to reduce duplicate sends.
- Browser journey, provider sandbox, sustained load, race/deadlock, distributed deployment, accessibility tests. A local dump/restore drill verified all 53 tables and removed its temporary database/archive.

The above gaps are material. Do not label this application commercially production-ready or all 30 specification sections complete until they are closed and independently verified.
