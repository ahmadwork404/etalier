# UI and flow QA — 11 November 2026

## Implemented

Shared primary forest (#234c40), secondary ivory (#f6f3eb), accent terracotta (#a84f38), with neutral text/surface tokens and derived tints. Updated navigation, authentication, dashboard, panels, forms, calendar cards, badges, metrics, dialogs, customer pages, keyboard focus and narrow-screen form layout. Charts use the primary token.

Booking availability now clears when dependencies change and cancels obsolete requests, preventing an older stylist/date response from replacing the current selection. Stylist selection requires a branch. Missing tokens receive actionable feedback in account and customer links.

## Executed and passed

- Production build: API TypeScript, Next compilation, frontend TypeScript and all seven routes.
- Six security unit tests: opaque sessions and feature/plan/dependency enforcement.
- PostgreSQL integration: tenant isolation, composite foreign keys and concurrent booking exclusion.
- API integration: workspace impersonation, feature bypass and session replay.
- Salon journey integration: scheduling and race rejection, inventory consumption, checkout/payment idempotency, refund protections, forms and audit.
- Browser inspection: all 19 enabled navigation destinations, customer create dialog opening/closing, empty directory pagination, calendar empty state, integration status and settings.
- Browser responsive inspection at 390 × 844: mobile navigation and overview cards.
- Browser verification: submitting /verify without a token shows the new incomplete-link error.

The existing integration tests create temporary QA records and remove their own records. The database test rolls back its transaction. Existing owner data was not edited during browser inspection.

## Remaining coverage

This is not exhaustive verification of every flow or edge case. Browser inspection of empty pages does not establish successful create/edit/delete behavior. Still needed: populated browser CRUD and validation for each module, public booking success and timezone boundaries, aborted-request race verification, all roles and platform-admin UI, pagination beyond 25 records, offline/server failure recovery, keyboard dialog focus containment, provider callbacks/retries, attachment upload/verification and notification delivery. Some modules are disabled for the current salon; unreleased modules are outside executable coverage.

## Environment needed for provider tests

Set values locally in apps/api/.env. Do not commit secrets. Use test/sandbox credentials and controlled recipient addresses/numbers.

- Email: RESEND_API_KEY, RESEND_FROM
- SMS/WhatsApp: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM, TWILIO_WHATSAPP_FROM
- Private file storage: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET; bucket CORS must permit the frontend origin.
- Stripe test checkout/webhooks: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET; forward signed checkout.session.completed and checkout.session.expired events to /api/v1/webhooks/stripe.
- URLs: WEB_ORIGIN and PUBLIC_APP_URL (currently http://localhost:3000).

Database variables already exist locally and the connection was verified: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DATABASE_NAME. No additional database credentials are needed for the checks executed here. Provider integrations all showed Not configured in the UI. Workers were not started.

## Commands

From atelier-platform: npm test; npm run build.
From apps/api with the API on port 4000: npx tsx --test tests/database.integration.ts tests/api.integration.ts tests/journey.integration.ts.


## Populated QA update — 11 November 2026

- React toast stack: 5,000 ms success, 10,000 ms errors; manual dismissal; stable independent timers; duplicate message suppression; responsive placement; success status and error alert semantics. Transient action-error banners are replaced with toasts. Persistent loading/retry panels, field guidance, completed transaction details and copyable private results remain in context.
- Grouped, collapsible sidebar with distinct Lucide icons per destination. Secondary groups start collapsed. Navigating to a destination opens its group. Existing feature and permission filters remain in force.
- Deterministic illustrated avatars for people, name badges, category illustrations for services/products, and matching detail-header visuals. These are illustrations, not actual profile photos or a photo-upload feature.
- Fixed logout to reload the signed-out page, and validation toasts now use API field details instead of the generic input message.

### Persistent synthetic salon

Atelier QA Studio was created through the API with its own owner. Sign-in details are stored only in ignored `.qa/qa-access.json`. The user's original salon records were not edited. Browser testing signed out the original session and switched into the QA account.

Seed: `apps/api/scripts/seed-qa.ts`; extension: `apps/api/scripts/extend-qa.ts`. These scripts retain QA data, write local completion reports and refuse to repeat a completed run. An interrupted run may require manual inspection before retrying. Keep the `.qa` directory private and untracked.

Data includes 28 original customers plus a public-booking customer; four employees (including one without working hours); two branches; four services including a free consultation; three products (normal, low and zero stock); working hours; several appointment statuses; two orders; payment/refund; expenses; paid/draft payroll; leave; an intake form/submission; review; text-only UGC without marketing consent; loyalty points; membership plan/member; gift card; disabled workflow; draft campaign. Nothing was queued for provider delivery and no notification worker was started.

### Executed checks

- Seed run: 131 API requests/assertions, including page 1/page 2 lengths, empty search, invalid service price, reversed leave dates and insufficient stock rejection.
- Extension run: 41 API requests/assertions, including form consent failure/success/replay, invalid review rating, loyalty idempotency/insufficient points, public booking success/conflict, invalid timezone/currency, and populated engagement reads.
- Six unit tests and all three existing integration suites passed again.
- Production build passed after the initial implementation. Final follow-up build is checked in the chat result.
- Browser: QA sign-in/workspace selection; employee edit/save; illustrated employee/service records; all 37 enabled destinations (overview, employees, and 35 additional destinations); group collapse/expand; success toast display and removal; duplicate-address error toast and removal while field errors remain available during editing.

172 is a count of API requests/assertions, not a count of independently tested user journeys. Browser navigation checks establish rendering, not every CRUD operation.

### Still needed

Provider credentials listed above remain missing: Resend, Twilio, R2, Stripe. Actual photo uploads require storage configuration and a profile-photo feature. The current illustrations need no environment variables. Full provider delivery, signed webhooks, binary uploads/verification, every permission role, every CRUD validation combination, all timezones, and broad accessibility/offline testing remain unverified. No claim of exhaustive coverage is made.

Final verification: production build passed. Browser checked the final detailed duplicate-address toast, confirmed its removal after 10.5 seconds while inline guidance remained, and confirmed a save toast disappeared after 5.5 seconds. Final mobile employee layout and grouped menu were inspected at 390 × 844; viewport override was reset. Logout returned immediately to sign-in; QA login and workspace selection were restored. The retained preview is signed into Atelier QA Studio.

## Login, salon selection and URL navigation — 12 November 2026

- Login includes a Forgot password link at /forgot-password; account creation is removed from this screen. Removed the scissors tile and promotional eyebrow text.
- Password reset submits to the existing request-reset endpoint. Actual email requires RESEND_API_KEY and RESEND_FROM; unconfigured email returns an explicit error rather than a false success.
- API login assigns the sole active salon to its session; multiple active salons leave selection open. Existing sessions also auto-select a sole available salon. No selected salon displays salon cards, not the prior creation onboarding. Zero active salons receive an access explanation and sign-out action.
- Replaced the native salon dropdown with a custom button/popup and current-salon display for one-salon accounts. Selection does not emit a Changes saved toast. Switching salons clears cached business queries and route filters while retaining the current page.
- Sidebar destinations have real hrefs and routes: /customers, /employees, /services, /calendar, /orders, etc. Native browser history preserves back/forward. Direct reloads resolve via the validated workspace route.
- Customer/employee/service search uses q; directory pagination uses page; calendar uses date/view/employee; analytics uses from/to. Filter state is read from URL query parameters, with validation for pagination and dates. New searches reset pagination; page changes clear prior page filters.
- Added a separate synthetic multi-salon owner with QA City Studio and QA Garden Studio; local credentials are in ignored .qa/multi-salon-access.json.
- Six unit tests passed. Existing API security and salon journey integrations passed, including new single-salon and multi-salon login assertions. Production build and final browser verification are recorded in the chat.

## Admin separation and customer pages — 12 November 2026

### Platform versus shop access

Migration 008 adds max_locations (default one, preserving the count of existing locations) and a separate admin_enabled flag for each shop module. Applied locally. Platform accounts cannot create/select tenants or use tenant operations, even if accidentally assigned a shop membership. The admin console has only shops, members, modules, activity logs and jobs. There is no create-workspace action.

Admin can suspend/reactivate shops, configure location allowance, disable/re-enable/remove shop memberships, and restrict global or individual-shop modules. A shop owner cannot override an admin module restriction. Location creation locks the shop row before checking capacity; a concurrent-create test confirms the limit cannot be exceeded. More detailed location/workspace rules remain deferred as requested.

Platform activity logs support person/shop/search/page filters in the URL. They display recorded audit events; this is not a claim that every read or UI click is audited.

### Customers

- Table columns: photo/name (illustrated placeholder), email, cellphone, and separate view/edit icons. Contact buttons copy their value and display a five-second success toast; clipboard failure displays an error toast.
- Search matches names, email and cellphone. Filters: contact completeness, marketing consent, and name/creation-date ordering. Queries run server-side and pagination reports total results. Filter and page state is in the URL.
- View opens /customers/{id}. Separate upcoming/past appointment and invoice tabs have URL state and independent paginated API reads. There is no 100-record cap in these profile collections. Invoice rows reflect stored orders, their line items, payment/refund totals and status; no new legal invoice numbering or tax-document certification is implied.
- Quick email/SMS composers include recipient, message purpose and explicit Send. Marketing requires permission and consent. API validates contact details, permissions, enabled modules and provider configuration. Successful requests enqueue idempotent notification jobs. The existing worker performs delivery; the UI says queued, not sent. No messages were sent during QA and the worker was not started.
- Current pictures are generated illustrations, not actual uploaded customer photos.

### Verification

Six security unit tests passed. All four integration suites passed against an isolated local API on port 4001, including the new platform-customer suite. Added tests cover admin operational denial, accidental memberships, location races, below-current-count limit rejection, module overrides, member removal/re-enabling, shop suspension, actor-filtered logs, contact/consent/sort filters, customer isolation, and actual customer invoice/refund/history reads. The login rate limit remains 20 attempts; its errors now return clear JSON.

Browser checked customer email/cellphone clipboard contents and toasts, server filters, view-page navigation/reload, upcoming/past appointments, invoice line items/totals/refunds, separate edit dialog, and disabled quick-send states with absent providers. Also checked admin-only navigation, shop/member controls, per-person activity logs and per-shop module controls. Real shop records were not changed by these browser checks.

Dedicated local fixtures are in ignored .qa/platform-admin-access.json and .qa/customer-profile-example.json. Existing owner fixture remains .qa/qa-access.json. Test-only login credentials are not committed.

Pending: real email/SMS delivery requires RESEND_API_KEY, RESEND_FROM, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM, plus the notification worker. Actual photo upload remains a separate feature needing private R2 configuration. Provider delivery/retries and every role/UI combination are not exhaustively verified.

Final check: the production build passed for all routes, including /login, /salons, /admin/* and /customers/{id}. The final browser run verified that a protected filtered customer link redirects to /login with returnTo and restores the same filter after sign-in. Mobile customer table inspected at 390 × 844; filters wrap and the table scrolls horizontally. Viewport reset. The retained review tab is signed into the synthetic shop owner on /customers?q=Mariam. No external messages were sent. The temporary port-4001 test API was stopped; normal local API and frontend remain available.

## Latest profile, mobile and theme changes — 12 November 2026

Implemented in source:

- The generic Customers heading/eyebrow/description is omitted on an individual customer URL. The profile uses the customer's name as its h1. Tabs are centered and more prominent; empty record states fill the timeline area and center vertically.
- Edit no longer contains appointment history or portal-link creation. The view page retains appointment history and now provides portal creation/copy/open actions.
- Customer value summary includes six-month net collected, appointment outcomes, completed/upcoming visit counts, and estimated contribution after current product/consumable costs and recorded commissions. It explicitly excludes tax, other labor and overhead and is not labelled net profit. Financial metrics enforce finance permission and shop/module restrictions. New numerical assertions were added to the integration suite but could not be executed in the final verification window.
- Photo selection/preview/upload/verification is available in Edit. JPG/PNG/WebP up to 5 MB. Missing R2 settings do not disable file selection: Upload returns a configuration error while retaining the unsaved preview. Verified private photos render in the directory and profile through an authenticated photo endpoint and short-lived signed R2 GET URL. Migration 009 was applied. Actual R2 transfer/read-back remains unverified because credentials are absent.
- Missing cellphone displays `-`; the marketing-consent subtitle is removed from directory rows. Password visibility controls cover login, reset and account-password forms. Toasts have no left accent stripe.
- All native select widgets were replaced with the shared themed CustomSelect: controlled/uncontrolled values, form values, required validation, disabled options, portal positioning, keyboard navigation/typeahead, Escape/outside dismissal and option checkmarks. Cursor text selection and carets use theme colors. Runtime browser validation of this final custom-select implementation remains pending.
- Mobile customer directories, appointment/invoice history and platform activity logs use compact cards rather than horizontal tables. Mobile customer filters, detailed financial charts, extra contact information and shop management controls are progressively disclosed. Desktop tables remain.
- Store currency is selected through a themed code/symbol dropdown. Currency context, application shop creation and fallback values default to USD/$; existing shop currencies remain unchanged. Monetary labels and gift balances use the current store setting instead of hard-coded PKR/Rs. Migration 010 changes the database-level default only and is still pending; application-created shops already specify USD explicitly.
- Local ignored apps/api/.env sets WEB_ORIGIN=*. Non-production API CORS reflects any requesting origin so credential cookies work; request-origin checks follow this test setting. Production still requires an explicit origin. docs/r2-cors.development.json contains a separate S3-compatible wildcard bucket CORS example; it has not been applied remotely.

Verification and concrete blockers:

- Final frontend TypeScript checks pass. API TypeScript build passes. All six existing security unit tests pass.
- A full build passed earlier in this update before the last custom-dropdown/mobile/currency changes. A separate final output build in .next-verify failed with EPERM while creating a generated route directory. Do not treat that final build as passed.
- The elevated integration-test command was not executed: automatic approval review could not complete because the execution usage limit was reached. This was a review failure, not a finding that the command was unsafe. No elevated-action workaround was attempted.
- An isolated component fixture was bundled successfully to ignored .qa/ui-components.html. Browser verification of that file was rejected because the browser only permits HTTP/HTTPS. No workaround for that browser policy was attempted. This fixture is not evidence of a passed browser test.
- The latest source still needs a full build, preview restart, browser QA and the new integration assertions run when execution access is available. The running preview may show the previous built version. No real email/SMS or R2 writes were performed.

Pending local verification commands (after execution access is restored): npm run db:migrate; npm run build; npm test. Use an isolated test API and ATELIER_TEST_API_URL for the integration suites as described above. Restart the frontend after the successful build.

R2 values needed for real uploads: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET. Keep the bucket private; use the provided development CORS only for testing.
