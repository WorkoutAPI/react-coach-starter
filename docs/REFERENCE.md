# React Coach Starter — technical guide

[← Back to the project overview](../README.md)

**A clear coaching workspace, powered by Workout API.** Build structured training plans, assign them to clients, keep conversations close to the work, and record actual training progress. The application is a React and Node.js foundation for independent strength coaches and coaching teams.

The starter is free to use, rebrand, and extend. Its demo runs without accounts, PostgreSQL, or a Workout API key. Live mode uses PostgreSQL for application data and the official [`@workoutapi/sdk`](https://www.npmjs.com/package/@workoutapi/sdk) for exercise data and program generation.

## What works

- Coach registration and sign-in; private client invitations with expiring links; client sign-in; session cookies; profile updates, password changes, recovery via SMTP, and account deletion.
- Coach-managed client goals and notes, with server-side ownership checks.
- Workout API exercise search, muscle/category reference data, program generation, draft saving, exercise prescription adjustments, program detail updates, and public sharing in live mode.
- Program assignment, client program view, completed exercise logs, date-grouped training history, exercise evolution charts for coaches and clients, and private coach/client messages.
- Exercise illustrations in compact lists, progress history, and dashboard activity, with a 24-hour image cache in live mode. Expanded program exercises load an interactive animated embed on demand.
- Responsive light and dark interface based on shadcn-style components, Radix primitives, Tailwind tokens, and a single brand configuration.
- English UI catalog using i18next and react-i18next, ready for another language without moving copy out of components later.
- An isolated **fictional** demo for exploring the complete coach/client flow. Each browser gets its own temporary demo workspace; visitors cannot see or change one another's edits. Reloading the page resets that workspace. Demo training submissions leave the sample history unchanged. Workspaces expire after seven days and reset when the server restarts.

The application stores users, relationships, program snapshots, logs, and messages locally. Workout API supplies the exercise catalog and generated training prescriptions. Program snapshots preserve the assigned plan and training history if Workout API becomes temporarily unavailable.

## Stack

React 19, Vite 7, TypeScript, Tailwind CSS 3, Radix UI and shadcn-style source components, Express 5, Prisma 6, PostgreSQL 17, pnpm, and the official Workout API SDK 1.0.0. Node.js 22+ is required by the SDK; use a supported LTS release for production. Prisma 6 and Tailwind 3 are intentionally retained as compatible stable majors for this starter's schema and token setup; upgrading either requires a dedicated migration.

## Quick start: demo

```sh
corepack enable
pnpm install
cp .env.example .env
pnpm db:generate
pnpm dev
```

Open `http://localhost:3000` and enter as coach or client. Vite serves the development interface on `3000` and proxies `/api` to the backend on `3001` by default. In production, Express serves the built interface and API together on `3000`. `APP_MODE=demo` is the default. The banner marks every screen as demo data. The demo does **not** call Workout API or PostgreSQL.

## Live setup

1. Create a Workout API account at [workoutapi.com](https://workoutapi.com/) and retrieve a key from your dashboard. The [API docs](https://docs.workoutapi.com/api) and [SDK guide](https://docs.workoutapi.com/sdk) describe the contracts.
2. Set `APP_MODE=live`, `WORKOUTAPI_KEY`, `DATABASE_URL`, `SESSION_SECRET` (at least 32 random characters), and `WEB_ORIGIN` in `.env`. Keep `.env` outside version control.
3. Choose a PostgreSQL setup below: use an existing local instance or start the optional Docker service. Both examples use localhost port `5432` and the `DATABASE_URL` shown in `.env.example`.
4. Run `pnpm db:generate` and `pnpm db:migrate`, then `pnpm dev`. If this database already used the pre-release migrations, follow “Migration baseline” below before `pnpm db:migrate`.
5. Create a coach account. Search the exercise library to verify the key, invite a client, generate a program, and assign it.

If the key is missing or invalid, live exercise and program requests show an explicit error. The server never substitutes demo results. Workout API access is subject to the service's actual terms, account permissions, and quotas; no paid tier or quota size is assumed here.

### PostgreSQL on your computer (no Docker)

If PostgreSQL is already running locally on port `5432`, connect with a PostgreSQL role that can create roles and databases. Replace `ADMIN_USER` with that role's name (for example, `postgres` or the administrator created by your PostgreSQL installation):

```sh
psql -h localhost -p 5432 -U ADMIN_USER -d postgres
```

In the `psql` prompt, create the development role and database used by `.env.example`:

```sql
CREATE ROLE coach LOGIN CREATEDB PASSWORD 'coach';
CREATE DATABASE coach OWNER coach;
\q
```

Run these `CREATE` commands only once. If the role or database already exists, use it as is. The example password and `CREATEDB` permission are for local development only: `pnpm db:dev` needs to create a temporary shadow database when generating migrations. For an existing local `coach` role without that permission, run `ALTER ROLE coach CREATEDB;` as a PostgreSQL administrator before using `pnpm db:dev`. Do not grant `CREATEDB` to the application's production database role. Then run `pnpm db:migrate` from the project directory to create the application tables. A database URL does not create the database, and migrations require it to exist first.

### PostgreSQL with Docker (optional)

If port `5432` is free, run `docker compose up -d db`. Compose creates the `coach` role and database on the first startup and keeps the data in a project-specific volume. Then run `pnpm db:migrate`. If another PostgreSQL server already uses port `5432`, use the local-instance instructions above or stop that server before starting the Docker service.

### Migration baseline

The first public release has one migration, `prisma/migrations/0_init`, which creates the full schema on a new database. If a database already has all six pre-release migrations, do not run the init SQL against it. First verify its schema matches `prisma/schema.prisma`, then run `pnpm exec prisma migrate resolve --applied 0_init` once to record the baseline without recreating tables. Afterwards, `pnpm db:migrate` applies only future migrations. The six older migrations remain recorded in that database's `_prisma_migrations` table; their data backfills are already complete. The original migration files are not needed for a fresh installation.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `APP_MODE` | `demo` or `live`; demo uses isolated in-memory fictional data. |
| `DATABASE_URL` | PostgreSQL connection string, required in live mode. |
| `WORKOUTAPI_KEY` | Server-only key for the official SDK, required for live fitness operations. |
| `WORKOUTAPI_BASE_URL` | Optional API base URL; defaults to the official production API. |
| `SESSION_SECRET` | Secret for hashing sessions and invitation/reset tokens; 32+ characters in live mode. |
| `WEB_ORIGIN` | Exact browser origin used for mutation origin checks and invite/reset links. |
| `PORT` | Browser-facing application port, default `3000` (Vite in development, Express in production). |
| `API_PORT` | Internal Express port during development, default `3001`. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | SMTP settings for password recovery, invitation, message, and program emails. `.env.example` uses fictional Mailpit values for local testing; use your provider's settings and an approved sender for real delivery. Without `SMTP_HOST` or `SMTP_FROM`, recovery returns a configuration error. |
| `SEED_DEMO_PASSWORD` | Opt-in password for `pnpm db:seed`; never used in normal startup. |

### Optional fictional database fixtures

The demo mode needs no seed command. It opens with two fictional clients and assigned three-day programs. Each client has 26 weeks of training history: 58 completed program days (about three quarters of the entries) and 20 individual exercise logs. Guided days contain the prescribed exercises and recorded sets; isolated logs rotate through the ten illustrated exercises. Loads and reps change gradually, with occasional lighter weeks, so pagination, date filters, charts, and exercise comparisons have meaningful data immediately. Bodyweight movements have no recorded external load. The fictional fixture history is kept in server memory rather than browser local storage and resets when the server restarts; it never calls Workout API. Each browser receives a separate in-memory copy of the demo workspace, so edits made by one visitor are not visible to another. Reloading the page resets that workspace. A workspace is associated with a private browser cookie, expires after seven days, and can be evicted sooner when the server reaches its bounded capacity. A session being tried in demo mode is held temporarily in that visitor's workspace while it is in progress, then discarded when finished or abandoned. Logging an individual exercise in demo mode validates the form and simply closes the dialog without adding to history or statistics. Finishing a demo session shows its completion screen without saving it; neither action shows a success toast. The ten local SVGs in `public/demo/exercises/` appear in the library, programs, progress history, and exercise details. To deliberately add clearly fictional accounts to a live database for local development, set `SEED_DEMO_PASSWORD` (10+ characters) and run `pnpm db:seed`. This creates `coach@demo.local` and `sam@demo.local` and an example plan. Do not seed production data.

## Product flow and permissions

Coaches register, invite clients with a private seven-day link, record goals, generate a plan with Workout API, review it, assign it, and discuss progress. Clients accept an invitation, view only assigned plans, run guided training sessions, log individual exercises when needed, and message their coach. Coaches can review logs and completed guided sessions for their own clients. All resource authorization happens on the server. A coach cannot query another coach's clients, plans, logs, sessions, or messages. In live mode, the invitation is emailed when SMTP is configured; the private link remains available to copy if delivery is unavailable. Demo mode keeps the manual link.

The client **Train** screen starts a day from an assigned program and saves a snapshot of that day's exercises. The client records repetitions and optional weight for each set, can change exercise order, skip a planned exercise, search the exercise catalog for an additional movement, resume an unfinished session, or discard it. Only one unfinished session per client is allowed. The server verifies that the program is assigned to the client and that extra exercises exist in the catalog. In live mode, finished sessions appear in Progress for the client and their coach, with every recorded set; the dashboard's training-day counts include them. Guided sessions stay readable if the source program is later edited or unassigned. A fresh live installation gets these tables from `0_init`.

The Progress screen shows completed program days and individual exercise logs in one dated timeline, eight entries per page. Program days retain their individual sets. Clients choose a date when logging an individual exercise; the form defaults to today and accepts earlier dates. The separate `performedOn` date keeps a selected manual training day stable across coach and client time zones. Each exercise's Evolution view lets coaches and clients filter both manual exercise logs and sets from completed guided sessions by start and end date. Its day-by-day comparison table shows ten filtered days per page, while the summary and charts continue to use the full selected date range. Its summary highlights the last training day, latest logged performance, best load, and change in estimated strength from the first to the latest comparable day. Charts show daily best load, estimated one-rep max, session volume, and best repetitions per set. Volume is sets × reps × load; entries without load do not contribute to weighted metrics. The estimate uses the Epley formula only for entries of up to 12 reps, and the change requires at least two qualifying days. Manual logs record aggregate sets and reps per exercise; guided sessions preserve every set separately. Both sources contribute to the Evolution charts in live mode and from the fictional fixtures in demo mode.

Workspace navigation uses paths such as `/progress` and `/settings`. Direct links and browser back/forward work with the Vite development server and the production Express fallback. Old `/#progress` links are replaced with the corresponding path when opened.

Each account can choose kilograms or pounds in Settings → Profile. The preference applies to recorded loads, charts, and program prescriptions in that account's view. Logs and generated program prescriptions remain stored and sent to Workout API in kilograms; pounds entered in the UI are converted before saving. Accounts default to kilograms. Individual exercise logs keep a separate workout date so a selected day remains stable across coach and client time zones. Run `pnpm db:generate` and `pnpm db:migrate` when updating a live installation.

Account password recovery sends a one-hour link through the configured SMTP server. Account deletion removes the account and its conversations and training logs through database cascades. When a client deletes their account, their coach’s assigned programs remain as unassigned drafts; when a coach deletes their account, their clients and programs are deleted as well. In-memory authentication throttling is included for a single server instance; distributed deployments should add a shared rate limiter at the edge.

### Email templates and local testing

Transactional emails use [React Email](https://react.email/) in `server/email/`. Every template passes its content through `renderEmail` in `server/email/index.tsx`, which wraps it in the shared `server/email/layout/` header and footer and produces both HTML and plain text. The layout reads the product name, organization, support address, and light-theme colors from `src/config/brand.ts`. Sent emails include `public/email-logo.png` as an inline CID attachment, so the logo also displays when sending from localhost; the mail transport uses the copy in `dist/` in production. Previews load `server/email/templates/static/email-logo.png` from the React Email preview server. After editing the logo, regenerate the 96×96 image with `rsvg-convert -w 96 -h 96 public/logo.svg -o public/email-logo.png` and copy it with `cp public/email-logo.png server/email/templates/static/email-logo.png`; it displays at 48×48 for sharpness. Email styles are inline for mail-client compatibility. The website's shadcn/Radix components and browser CSS are not used inside emails because mail clients cannot reliably render them.

Email copy has its own i18next instance and catalogs in `server/email/i18n/`. English and French are included, with English as the fallback for unsupported locale codes. Password recovery uses the account’s saved language, including when the user is signed out. To add an email, create its content and send function in `server/email/templates/`, put all visible strings (including subject, preview, header/footer additions, and text rendered from HTML) in the email catalogs, call `renderEmail({ locale, subject, preview, content: <YourContent /> })`, and send the returned `{ subject, html, text }` through Nodemailer. The same template file can default-export a preview with fictional data and a `locale` PreviewProp; no separate preview file is needed. Add rendering tests and keep secrets and personal information out of logs. `server/email/templates/password-reset.tsx` is the working example. `pnpm email:preview` opens the React Email preview server on port `3002`; its sidebar lists only the templates, and the `locale` prop can be changed there. Background emails use the recipient’s saved interface language; the coach’s language is used for invitations, since invitees have no account yet. English is the default and is used whenever the saved language is not enabled in `brand.languages` or has no email translation.

### Notification emails

In live mode, assigning a program queues an email to the client. A new message queues an email for its recipient after ten minutes; messages from the same sender are grouped, and the worker skips messages read before delivery. Message notifications contain the sender name and unread message count, never the message body. Account settings let each user turn message and program notifications on or off. Email language follows the interface language automatically; there is no separate email-language control. Preferences are checked again at delivery, so switching them off also suppresses pending jobs. Invitations are sent immediately when SMTP is configured and remain copyable as private links.

The `EmailJob` table stores pending notifications and retry state. The server checks due jobs on startup and every minute, retries failed deliveries with increasing delays up to five attempts, and records `SENT`, `SKIPPED`, or `FAILED`. Apply migrations with `pnpm db:migrate` after updating. A single live server process should run the email worker; if you deploy several instances, add a shared claim/lock before enabling workers on all of them. No email is sent from automated tests.

To create another notification, add a template in `server/email/templates/` with the same `EmailLayout` and `ActionEmail`, add all strings to both email catalogs, create its `EmailJob` in the relevant database transaction, and handle that kind in `server/email/notifications/worker.ts`. Preview every template with `pnpm email:preview`, including its French `locale` prop.

For local delivery testing, run a mail catcher such as Mailpit (`docker run -d --name coach-mailpit -p 127.0.0.1:1025:1025 -p 127.0.0.1:8025:8025 axllent/mailpit`). Copy the SMTP example from `.env.example`, set `APP_MODE=live`, configure PostgreSQL and a session secret, then register a coach and request a password reset for that account. To test other templates, invite a client, assign a program, or send a message and leave it unread for ten minutes. Mailpit shows the captured email at `http://localhost:8025`; it does not forward it to the recipient. Restart the server after changing `.env`. The demo mode never sends email, and unknown addresses intentionally produce no email.

## Workout API integration

`server/lib/workoutapi/` is the only module that instantiates the SDK. The verified contract comes from the official SDK 1.0.0 README and the API's OpenAPI specification. The adapter uses `getExercises`, `searchExercises`, `filterExercises`, `getExerciseImageByCode`, `createExerciseEmbed`, `getMuscles`, `getCategories`, `generateProgram`, `saveProgram`, `patchProgram`, `enableProgramShare`, and `disableProgramShare`. These correspond to the exercise catalog, image, embed, reference, generation, persistence, and sharing endpoints in the current SDK. The SDK handles `x-api-key` authentication; the key is never sent to React.

The authenticated `GET /api/exercises/:code/image` route serves PNG illustrations in live mode. The server keeps successful images in a bounded in-memory cache for 24 hours, deduplicates simultaneous requests for the same code, and sends `Cache-Control: private` with the remaining cache lifetime to browsers. Missing images are cached for one hour. The cache is local to each server process and resets on restart; multi-instance deployments can replace it with a shared cache or CDN. Demo mode uses the supplied local SVGs instead of Workout API images. Image failures leave exercise names and prescriptions visible.

The authenticated `GET /api/goals` route provides the four program goals defined by the official SDK's `ProgramGoal` type. The published SDK does not include a `getGoals` operation and the upstream `/goals` path currently returns 404, so the local route keeps goal selectors consistent with the supported generation contract. Client profile, invitation, and self-service goal forms store the selected code; previously saved free-text goals remain readable until changed.

Opening a program exercise in live mode requests `GET /api/programs/:programId/exercises/:dayIndex/:exerciseIndex/embed`. The route checks coach ownership or the client's assigned program before creating an embed token. The SDK creates one origin-restricted embed configuration per server process and reuses its token; the iframe URL contains the public embed token and exercise code, never `WORKOUTAPI_KEY`. `WEB_ORIGIN` must match the browser origin for the embed to render. The frame enables autoplay and controls, and the UI can enlarge it. Demo mode shows the exercise's local static SVG in the same detail panel, with an enlarge option and no Workout API request. The embed configuration is process-local and a new one is created after a server restart.

During a live guided training session, the current exercise has an icon-only View movement button that opens the same Workout API embed in a dialog. `GET /api/training-sessions/:sessionId/exercises/:exerciseIndex/embed` checks the client owns an active session and that the exercise belongs to its snapshot, including exercises added during training. The dialog fetches only when opened and unloads the iframe when closed. Demo training has an icon-only enlarge button that opens the local exercise SVG in a dialog without any Workout API request. Program details keep their existing preview.

Generated drafts are saved immediately because the API documents that unsaved drafts expire after a day. The local `Program` stores a snapshot and the remote program ID. Public sharing is offered only for live, SDK-backed programs. Rate limits (HTTP 429), invalid keys (401), plan restrictions (403), and service failures have distinct messages. The SDK does not automatically retry or cache; this starter does not retry generation to avoid duplicate drafts.

The program creation dialog starts with one day; coaches can add or remove days up to a maximum of seven. It exposes the SDK's global level and goal plus every per-day generation criterion: label, muscles, categories, types, exercise count, target duration, automatic prescriptions, required and excluded exercises, and fixed or ranged sets, reps, rest, and weight for specific exercises. Coaches select named exercises and reference values; the UI sends their codes internally. Exercise count takes priority over duration when both are set. Advanced day criteria are collapsed until needed. The server validates the full payload before calling the SDK; demo mode applies the same inputs to its fictional exercise fixtures without calling Workout API.

## White-label customization

Edit [`src/config/brand.ts`](../src/config/brand.ts) for product name, organization, support contact, logo URL, locale, feature flags, colors, and fonts. The login portal and signed-in sidebar use `brand.logoUrl`, which defaults to [`public/logo.svg`](../public/logo.svg). The browser and Google Search favicon is [`public/favicon.png`](../public/favicon.png); the email header uses [`public/email-logo.png`](../public/email-logo.png). After editing the logo, regenerate the 192×192 favicon with `rsvg-convert -w 192 -h 192 public/logo.svg -o public/favicon.png` and the email PNG with the command in “Transactional emails” above. Shared UI components in [`src/components/ui.tsx`](../src/components/ui.tsx) use the theme variables in [`src/index.css`](../src/index.css). There is one coach workspace per coach account, with client isolation; this is not an organization-level multi-tenant billing system.

To change the color palette, edit `brand.theme` in `src/config/brand.ts`: `primary` is the light-mode accent, `darkPrimary` is its dark-mode variant, and the other color keys control text, surfaces, borders, and destructive actions. Values use space-separated HSL channels without `hsl()` (for example, `217.22 91.22% 59.8%` is `#3B82F6`). Keep the matching `:root` and `.dark` defaults in `src/index.css` in sync so the first paint uses the same colors; `src/config/theme.ts` applies the brand values at runtime. Transactional emails also read the light-theme colors from `brand.ts`. For a complete accent change, update the background in `public/logo.svg`, regenerate `public/favicon.png` and `public/email-logo.png`, and change the light-blue highlight `#93c5fd` in `src/pages/Auth.tsx` and `src/pages/Dashboard.tsx`. Keep `primaryForeground` and `darkPrimaryForeground` legible against the chosen primary colors.

### Interface language

The UI currently ships in **English only**. `en` is the language code; `en-US` in `brand.locale` controls English date formatting. All static React UI copy, placeholders, accessibility labels, notifications, and client-side API fallbacks live in [`src/i18n/en.ts`](../src/i18n/en.ts). Components use `useTranslation()` and `t('key')`; non-React code uses the i18next instance. [`src/i18n/index.ts`](../src/i18n/index.ts) registers the catalog, supported languages, fallback, and date locale. Brand-specific copy stays in `brand.ts`. User content and Workout API catalog data are displayed as returned. Server API error messages currently remain English. Email translations are independent in `server/email/i18n/`, with English and French catalogs.

To add another language, for example French:

1. Copy `src/i18n/en.ts` to `src/i18n/fr.ts`, rename the exported constant to `fr`, and translate every value while keeping the same keys. Keep interpolation tokens such as `{{name}}` and both `_one` and `_other` plural forms.
2. Import `fr` in `src/i18n/index.ts` and add it to `resources` beside `en`.
3. Add `fr` to `brand.languages`. Choose the initial language with the first entry, or add a language selector that calls `i18n.changeLanguage('fr')`. React screens update through `useTranslation()`, and the HTML `lang` attribute follows the selected language.
4. Add the language to `server/email/i18n/` and its `resources` map, preserving every email key. Changing the interface language updates the signed-in user’s saved email language automatically; existing users keep English until they choose the new language. Translate server errors if the new language must cover the full live workflow. Run `pnpm test`, `pnpm typecheck`, and `pnpm build`, then review the coach and client flows and rendered emails in both languages.

Translation keys are flat strings (dots are part of the key); `keySeparator: false` is set in the i18next configuration. Use complete sentences with interpolation for dynamic copy, so translators can change word order.

## Repository map

| Path | Responsibility |
| --- | --- |
| `src/pages/` | Coach and client screens. |
| `src/components/ui.tsx` | Reusable shadcn-style controls and states. |
| `src/config/brand.ts` | Brand and theme configuration. |
| `src/i18n/` | English UI catalog and i18next setup. |
| `server/index.ts` | Validated API routes and resource permissions. |
| `server/auth.ts` | Password hashing, sessions, and user guards. |
| `server/lib/workoutapi/` | Official SDK integration and errors. |
| `server/demo.ts` | Explicit fictional demo fixtures and transient state. |
| `prisma/` | PostgreSQL schema, migration, and optional fixture seed. |
| `tests/` | HTTP workflow and SDK adapter checks. |

## Commands

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm db:migrate
```

Tests use controlled responses and never spend a real Workout API quota. To verify a real key, use the exercise search in live mode. A successful exercise response proves the server key and network path are working.

## Deployment

Deploy the Node process and compiled Vite assets together: set `NODE_ENV=production`, configure the live environment variables, run `pnpm install --frozen-lockfile`, `pnpm db:generate`, `pnpm build`, `pnpm db:migrate`, then `pnpm start`. Point your HTTPS reverse proxy to `PORT` and set `WEB_ORIGIN` to the exact HTTPS origin. Use managed PostgreSQL, a persistent secret manager, and SMTP credentials. Run migrations before switching traffic. The server serves `dist/` in production. The included `docker-compose.yml` provides a local PostgreSQL service only.

An optional `Dockerfile` builds the same production server on Node.js 24. Build with `docker build -t react-coach-starter .` and pass the live environment variables at runtime. Run `pnpm db:migrate` as a separate release step before sending traffic to the new image.

The demo's in-memory changes do not persist and are unsuitable for production. Browser form errors, loading states, empty states, and confirmations are included. A single-instance memory rate limiter, no email verification, and no organization-level administration are current operational limits; add those if your deployment requires them. No telemetry is included.

For a PostgreSQL integration test, configure `APP_MODE=live`, a local database, and `SESSION_SECRET` in `.env`, apply migrations, then run `pnpm test`. The live test runs automatically when this configuration and the database are ready. In demo mode, with missing live settings, an unavailable database, or missing migrations, it is skipped and prints the reason. It creates disposable coach and client accounts, then removes all test-owned data in a `finally` block even if an assertion fails; it checks for remaining users, invites, programs, training sessions, logs, messages, and email jobs. It verifies guided training persistence, an individual exercise log, the combined Progress timeline, and Evolution data alongside the existing auth and messaging checks. Training uses a local program snapshot and makes no Workout API request.

## Extending the starter

Read [`AGENTS.md`](../AGENTS.md) before changing a user flow or the Workout API integration. Run typecheck, lint, tests, and build, and update the [project README](../README.md) and this guide when setup or workflows change. Keep `.env` and real client data out of version control.

## License & Commercial Usage

This boilerplate is free and open source under the [MIT License](../LICENSE). You may modify, rebrand, redistribute, and use it in commercial products or paid SaaS offerings while retaining required license and copyright notices. The source code license does not grant rights to Workout API's hosted service, proprietary data, or trademarks. Connected features require a valid Workout API key and are subject to its separate terms and account limits. See [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md) for major dependency licenses.

