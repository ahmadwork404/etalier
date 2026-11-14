# Etalier landing

A standalone Next.js 16 / React 19 marketing site for the Etalier salon SaaS. This project has its own package, configuration, components and build output. It does not import the CRM or access its database.

## Run

From the repository root:

```powershell
npm ci
npm run dev:landing
```

Open http://localhost:3001. The existing CRM stays on http://localhost:3000.

For a production Next.js build:

```powershell
npm run build:landing
npm run start --workspace etalier-landing
```

`npm start` runs Next.js on port 3001. The contact form uses a server route, so deploy this project with Vercel's Next.js preset rather than as a static export. The old `scripts/serve.mjs` is only for historic static builds.

## Configuration

Copy `.env.example` to `.env.local`. Production values are `NEXT_PUBLIC_APP_URL=https://portal.etalier.app` and `NEXT_PUBLIC_SITE_URL=https://etalier.app`. Set the server-only `BACKEND_API_URL` to your backend origin when its host is selected; localhost is for local development only. Main calls to action open the contact form; sign-in links open the CRM. Contact submissions are stored by the backend and owner notifications are queued there. No Resend or database credentials belong in Vercel's public environment variables.

## Design and behavior

Inspired by Miro's spacious canvas storytelling, playful accents, and bold typography; original Etalier layout, copy, icons, and product illustrations. Cream, forest, yellow, mint, and peach; responsive mobile navigation; reduced-motion support; keyboard-accessible controls; FAQ accordions.

The product preview has three working tabs. Calendar entries open sample detail cards. Quick Work lets visitors select services and record a local demonstration visit. The team tab changes the sample payroll frequency and recalculates the preview. All preview records are illustrative, remain in browser memory, and never create real bookings, payments, or payroll records. No invented testimonials, customer counts, or commercial pricing are presented.

## Assets

Typography: DM Sans from Google Fonts, with system fallbacks. Stock images are loaded from Unsplash:
- Baylee Gramling: https://unsplash.com/photos/RnHhR_sip7M
- Vinicius amnx Amano: https://unsplash.com/photos/lK8oXGycy88
- License: https://unsplash.com/license

The stock customer photo represents fictional demo content and is not a testimonial or endorsement. Miro reference: https://miro.com/

Dependencies are installed through the repository-root npm workspace and lockfile. The landing remains independently deployable and does not import the CRM's application source.
