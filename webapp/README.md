# REX Web App

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Nuxt 3 (SSR + serverless API routes) |
| UI | Vue 3, Tailwind CSS, Chart.js |
| Auth | nuxt-auth-utils (encrypted session cookies) |
| Database | Neon (serverless Postgres) + Drizzle ORM |
| File storage | Cloudflare R2 (presigned PUT, browser-direct) |
| Deployment | Vercel (serverless) |
| Blockchain data | Public JSON files on Polygon; polygonscan links |

---

## Prerequisites

- Node.js 20+
- A [Neon](https://neon.tech) project
- A [Cloudflare R2](https://dash.cloudflare.com/) bucket with public access enabled
- A [Vercel](https://vercel.com) account

---

## Local development

### 1. Configure environment

Copy `.env.example` to `.env` and fill in every value:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon connection string (`postgresql://...`) |
| `NUXT_SESSION_PASSWORD` | ≥32-char random string for cookie encryption |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 API token key ID |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret |
| `R2_BUCKET_NAME` | R2 bucket name |
| `R2_PUBLIC_URL` | Public base URL for the bucket (e.g. `https://pub-xxx.r2.dev`) |
| `R2_UPLOAD_URL` | Custom domain connected to R2 bucket for browser presigned PUT uploads (required for CORS) |
| `GEMINI_API_KEY` | Google AI Studio API key for document verification |
| `GEMINI_MODEL` | Gemini model ID (e.g. `gemini-2.5-flash-lite`) |
| `NUXT_PUBLIC_COMPANIES_URL` | URL to `companies.json` |
| `NUXT_PUBLIC_CONTRACTS_URL` | URL to `contracts.json` |
| `RETURN_WALLET` | Lowercase address of the REX return/settlement wallet |

Generate a session password:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Push the database schema

```bash
npm run db:push
```

This applies the Drizzle schema to your Neon database without needing a migration file.

### 3. Create the first admin user

```bash
DATABASE_URL="..." \
ADMIN_USERNAME="admin" \
ADMIN_EMAIL="admin@yourorg.com" \
ADMIN_PASSWORD="a-strong-password-12+" \
npm run seed:admin
```

This inserts the first `isAdmin=true` user. Subsequent users are created via the Admin → Users page in the app.

### 4. Start the dev server

```bash
npm run dev
```

Navigate to `http://localhost:3000/login` and sign in with the credentials you seeded.

---

## Testing

### Unit tests (Vitest)

```bash
npm test          # Run once (this is what CI runs)
npm run test:watch # Watch mode for local development
```

Unit tests live in `tests/unit/` and cover validation logic and auth helpers (e.g. `orders-validation.test.ts`, `users-validation.test.ts`, `auth.test.ts`). They don't hit a real database — see `tests/setup.ts` for mocks.

### End-to-end tests (Playwright)

E2E tests live in `tests/e2e/` and drive a real Nuxt dev server with a real browser (Chromium). They are **not currently run in CI** — the relevant steps are commented out in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — so run them locally before merging changes that touch auth, onboarding, or navigation guards.

One-time setup:

```bash
npx playwright install chromium   # Download the browser binary
npm run seed:test-user            # Create/upsert the E2E test user (needs DATABASE_URL, TEST_USER_USERNAME, TEST_USER_EMAIL in .env)
```

Run the tests:

```bash
npm run test:e2e       # Headless run
npm run test:e2e:ui    # Interactive Playwright UI (recommended while writing/debugging tests)
```

Notes:

- `playwright.config.ts` boots the app itself (`npm run dev`) with a throwaway `NUXT_SESSION_PASSWORD` and `PLAYWRIGHT_TEST=true`, which activates `server/middleware/test-auth.ts` — never set `PLAYWRIGHT_TEST` outside of local/CI test runs.
- Most tests mock the session API via `page.route()` rather than hitting the real database, but onboarding tests do write to the DB pointed to by `DATABASE_URL` and cover their tracks via a `[Playwright Test]` project-name prefix that `tests/e2e/global-setup.ts` cleans up before each run. Run `npm run cleanup:test-submissions` if a run is interrupted and leaves stragglers behind.
- Onboarding tests make real Gemini API calls (`GEMINI_API_KEY` must be set), so a full run can take a few minutes.

---

## Neon setup

1. Create a project at [console.neon.tech](https://console.neon.tech).
2. Copy the **connection string** (pooled endpoint is fine for serverless).
3. Set it as `DATABASE_URL` in `.env`.
4. Run `npm run db:push` — Drizzle will create all tables automatically.

### Viewing data

```bash
npm run db:studio   # Opens Drizzle Studio at localhost:4983
```

---

## Cloudflare R2 setup

1. Go to **Cloudflare Dashboard → R2 → Create bucket**.
2. Enable **Public access** (allows the `R2_PUBLIC_URL` base URL to serve files).
3. Under **Manage R2 API tokens**, create a token with **Object Read & Write** permission scoped to your bucket.
4. Note the **Account ID**, **Access Key ID**, and **Secret Access Key**.
5. The public URL is shown in the bucket settings under "Public bucket URL".

Files are never routed through Vercel — the client receives a presigned PUT URL and uploads directly to R2.

---

## Gemini document verification

Onboarding submissions are analyzed by Google Gemini to check whether each uploaded document matches the claimed generation type, capacity, location, and commissioning date. Results appear as AI verification badges in the admin review UI and inline on each step of the onboarding form.

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio API key (requires `generativelanguage.googleapis.com` access) |
| `GEMINI_MODEL` | Model ID to use (e.g. `gemini-2.5-flash-lite`) |

### Local development

Leave both variables unset. Verification calls will error and the form shows "Verification unavailable" — the submission flow is not blocked.

### Production

Add both variables in the Vercel dashboard (**Settings → Environment Variables**). The Gemini API is called server-side only; the key is never exposed to the client.

---

## Axiom logging

Server-side request and error logs are sent to [Axiom](https://axiom.co) via `@axiomhq/pino`. This is optional — if the env vars are absent, logs fall back to stdout only.

| Variable | Description |
|---|---|
| `AXIOM_TOKEN` | Axiom API token with `ingest` permission |
| `AXIOM_DATASET` | Axiom dataset name to write logs into |

### Local development

Leave `AXIOM_TOKEN` and `AXIOM_DATASET` unset — the logger will write to stdout. No Axiom account is required for local dev.

### Production

Add both variables in the Vercel dashboard (**Settings → Environment Variables**). Logs will appear in the configured dataset in real time.

> **Note:** These variables are read directly from `process.env` at module load time and bypass Nuxt's `runtimeConfig` layer — do **not** prefix them with `NUXT_`.

---

## Vercel deployment

### One-time setup

```bash
npm i -g vercel
vercel login
vercel link        # Link to your Vercel project
```

### Set environment variables

In the Vercel dashboard (**Settings → Environment Variables**) add every variable from `.env.example`.

> **Important:** `NUXT_SESSION_PASSWORD` must be the same on every deployment — rotating it invalidates all active sessions.

### Deploy

```bash
vercel --prod
```

Or push to `main` — Vercel auto-deploys on merge.

### Nuxt preset

Vercel is detected automatically by Nuxt 3. No `nuxt.config.ts` changes are needed. API routes deploy as serverless functions; static assets are served from the CDN edge.

---

## Database migrations

After changing `server/db/schema.ts`:

```bash
npm run db:push       # Diffs schema against live DB and applies changes (prompts before destructive operations)
```

For production or CI/CD where you want an auditable migration trail:

```bash
npm run db:generate   # Generate a migration file from schema diff
npm run db:migrate    # Apply pending migrations
```

---

## Public data files

`companies.json` and `contracts.json` are fetched client-side from the URLs set in `NUXT_PUBLIC_COMPANIES_URL` / `NUXT_PUBLIC_CONTRACTS_URL`. These are typically served from the same R2 bucket or a CDN. They are **not** stored in this repository.

For local development you can serve them from `public/`:

```bash
cp /path/to/companies.json public/companies.json
cp /path/to/contracts.json public/contracts.json
```

Then set:
```
NUXT_PUBLIC_COMPANIES_URL=http://localhost:3000/companies.json
NUXT_PUBLIC_CONTRACTS_URL=http://localhost:3000/contracts.json
```

---

## Project structure

```
webapp/
├── assets/css/main.css          # Global styles, OKLCH design tokens
├── components/
│   ├── admin/                   # Admin UI (OnboardingReview, OrdersQueue, CreateUser, LlmStatus)
│   ├── buyer/                   # Buyer UI (GoalsPanel, OrderPanel)
│   ├── dashboard/               # Shared dashboard (HeaderBar, AssetsTable, ActivityTable…)
│   ├── generator/               # Generator UI (GenerationChart)
│   ├── icons/                   # Inline SVG icon components
│   └── onboarding/              # Onboarding form sub-components (DocUpload, PhotoUpload)
├── layouts/
│   ├── default.vue              # App shell with sidebar nav
│   └── auth.vue                 # Centred login layout
├── middleware/
│   ├── auth.global.ts           # Redirect unauthenticated → /login
│   ├── admin.ts                 # Named: redirect non-admin → /dashboard
│   ├── buyer.ts                 # Named: redirect non-buyer/non-admin → /dashboard
│   └── generator.ts             # Named: redirect non-generator/non-admin → /dashboard
├── pages/
│   ├── login.vue
│   ├── dashboard/
│   │   ├── index.vue            # Shared portfolio dashboard
│   │   ├── generator.vue        # Generation chart + onboarding history
│   │   ├── buyer.vue            # Goals + order placement
│   │   └── admin/               # Admin sub-pages
│   └── onboarding/index.vue     # 8-step generator onboarding form
├── scripts/
│   └── seed-admin.ts            # First-admin-user seeder (run locally)
├── server/
│   ├── api/                     # Nuxt server API routes
│   ├── db/
│   │   ├── schema.ts            # Drizzle table definitions
│   │   └── index.ts             # DB client singleton
│   └── utils/
│       ├── auth.ts              # requireAuth / requireAdmin / requireGenerator / requireBuyer
│       ├── gemini.ts            # Gemini document analysis client
│       └── r2.ts                # Presigned PUT/GET helper
├── stores/
│   ├── auth.ts                  # Session state + login/logout
│   ├── contracts.ts             # Public blockchain data + derived computeds
│   └── generation.ts            # Generation time-series store
├── .env.example
├── drizzle.config.ts
├── nuxt.config.ts
├── tailwind.config.ts
└── package.json
```

---

## User roles

| Role | Access |
|---|---|
| **Admin** | Create users, review onboarding submissions, execute/cancel orders, view all data |
| **Generator** | Submit onboarding, view own generation chart and holdings |
| **Buyer** | Place buy/sell orders, set Scope 1/2/3 goals, view holdings |

A single user account can hold multiple roles (e.g. a company that both generates and buys RECs). Roles are assigned by an admin at account creation or via the Users management page.

---

## License

GNU GPLv3 in parent folder