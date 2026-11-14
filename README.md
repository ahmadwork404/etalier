# Etalier

One repository for the Etalier salon platform, customer-facing landing page, and original design prototype.

| Application | Source | Development URL | Production domain |
| --- | --- | --- | --- |
| CRM / portal | `atelier-platform/apps/web` | http://localhost:3000 | `portal.etalier.app` |
| Backend API | `atelier-platform/apps/api` | http://localhost:4000 | Cloudflare Workers |
| Landing and contact page | `etalier-landing` | http://localhost:3001 | `etalier.app` |
| Original prototype | `salon-studio` | Separate legacy preview | Not a production application |

## Install and run

Use a current Node.js release supported by the Cloudflare CLI (22.23+, 24.22+ or 26.12+). From the repository root:

```bash
npm ci
```

Copy `atelier-platform/apps/api/.env.example` to `.env` in the same directory and configure PostgreSQL and server secrets. Copy each frontend's `.env.example` to `.env.local` in that frontend's directory as needed. Secrets and generated files are ignored by Git.

```bash
npm run db:migrate
npm run admin:create
```

Start each service in a separate terminal:

```bash
npm run dev:api
npm run dev:portal
npm run dev:landing
```

Workspace names remain `@atelier/api`, `@atelier/web` and `etalier-landing` to preserve existing scripts and imports. The directory names are retained so existing deployment paths and local configuration continue to work. One root lockfile governs all three active applications; run dependency updates from the repository root. The original prototype keeps its own independent lockfile.

```bash
npm test
npm run build:cloudflare
npm run typecheck
```

The API unit tests do not need a running database. Database integration tests under `atelier-platform/apps/api/tests/*.integration.ts` require a configured development database; run them explicitly.

Build the existing portal container using the repository root as its context: `docker build -f atelier-platform/Dockerfile .`.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for Cloudflare deployments, domains, backend bindings and email configuration. The landing and portal remain separate deployable Next.js applications. Resend and R2 credentials belong only on the backend.

The `salon-studio` prototype is retained as source in this repository. It has a separate toolchain and lockfile, is excluded from the production npm workspaces, and does not run with the production apps. To work on it, install its dependencies from its own directory and use `npm run dev:prototype` from the root. See its own README for the original preview workflow.

Git remote: https://github.com/ahmadwork404/etalier.git
