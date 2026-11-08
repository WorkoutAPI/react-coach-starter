# Product overview

React Coach Starter is a white-label React coaching SaaS starter for independent strength coaches and their clients. Coaches invite clients, record goals, generate and assign programs, review logs, and exchange messages. Clients view assigned programs, log exercise performance, and message their coach. `APP_MODE=demo` uses clearly fictional, transient data; `APP_MODE=live` uses PostgreSQL and Workout API.

# Architecture

- React 19 + Vite + Tailwind + Radix/shadcn-style components in `src/`.
- Express API in `server/index.ts`; `server/auth.ts` owns password hashing, cookies, and route guards. Validate bodies with Zod and check ownership in every resource route.
- Prisma schema, migration, and opt-in seed in `prisma/`. `User` is coach or client; `Session`, `Invite`, `PasswordReset`, `Program`, `TrainingSession`, `Performance`, and `Message` are local data. A client has one coach. Program snapshots retain historical assignments.
- `src/config/brand.ts` controls brand-specific copy, assets, theme tokens, language defaults, and support links. UI primitives are in `src/components/ui.tsx`. When changing theme colors, keep the initial CSS values in `src/index.css` in sync, and update the favicon and any page-specific accent colors; see `docs/REFERENCE.md`’s “White-label customization” section.
- `server/email/` owns transactional email content. All emails go through `renderEmail` and the shared `server/email/layout/` layout for consistent header, footer, brand colors, HTML, and plain text. Every visible email string belongs in `server/email/i18n/` (separate from the UI catalog), with whole-sentence interpolation and an English fallback. Pass the triggering UI locale to email rendering; for background events, use the recipient's stored language preference when one is added. Put sendable templates in `server/email/templates/`, the only folder scanned by `pnpm email:preview`; give each template a default-exported preview with fictional data in the same file, not a separate preview file. Use React Email primitives with inline styles; do not import browser UI components or CSS into email templates. Add rendering tests for each new template.
- `src/i18n/en.ts` owns English UI copy; `src/i18n/index.ts` configures i18next. Components use `useTranslation()` rather than hard-coded visible text. `en` is the language code; `en-US` is the default formatting locale. See `docs/REFERENCE.md`’s “Interface language” section before adding a locale.
- `server/demo.ts` is an explicit in-memory fixture store. Never silently use it in live mode.
- Demo fixtures contain 58 completed program days and 20 isolated exercise logs per client. A newly started demo training session exists in server memory only while in progress and is removed on finish or discard. A demo `Log exercise` request validates the input without adding a log. Neither action changes demo Progress, dashboard statistics, or Evolution; finishing a demo session or submitting an isolated exercise shows no success toast. Live mode persists both kinds of training in PostgreSQL.
- Progress combines completed program days and isolated exercise logs in one dated, paginated timeline through `/api/progress-history`. Exercise Evolution reads both sources. Preserve ownership checks and the live persistence path when editing either mode.
- Exercise PNGs come from the SDK in `server/lib/workoutapi/` through an authenticated image route. Cache successful images for 24 hours, keep the key server-side, and render a fallback when media is missing. Demo mode must not request live media.
- Live mode can use an existing local PostgreSQL instance or the optional Docker Compose database. `DATABASE_URL` must point to an existing database before migrations; see both setup paths in `docs/REFERENCE.md`.
- `pnpm db:dev` requires a local PostgreSQL role that can create Prisma's temporary shadow database (`CREATEDB`) or a separately configured shadow database. Keep that privilege off the production application role. `.env*` files are ignored by Git and Docker except `.env.example`; never add real credentials to the repository.
- The first public migration history is the single `prisma/migrations/0_init` baseline. New databases apply it normally. Existing pre-release databases with the six older migrations must mark `0_init` as applied with `prisma migrate resolve --applied 0_init` before future deploys; never execute its create-table SQL against an existing populated database. See `docs/REFERENCE.md`’s “Migration baseline” section.

# Workout API integration

Workout API supplies fitness catalog data and program generation. Use the official `@workoutapi/sdk` on the server. Inspect the installed SDK types and official API docs before changing any call. Keep all SDK calls in `server/lib/workoutapi/`; do not expose `WORKOUTAPI_KEY` to React or create a generic provider layer. Keep remote program IDs with local snapshots. Handle 401, 403, 429, and service failures clearly. Never replace a live failure with demo data.

# Development standards

- Reuse the existing UI components and theme variables. Do not hard-code product branding in page components or force Workout API branding into the client experience.
- Put new static UI text, placeholders, accessibility labels, and client-side notifications in the translation catalog. Use whole-sentence interpolation and plural forms for dynamic copy. Keep translation keys stable when editing English wording.
- Validate inputs with Zod, enforce role and resource ownership on the server, use safe cookies, and preserve error/loading/empty states.
- Keep invitation, reset, and session tokens hashed in PostgreSQL. Do not log secrets or personal data.
- Add meaningful tests for changed permissions or SDK contracts. Update README when altering setup, environment, or workflows.
- `pnpm test` runs the demo suite and automatically runs `tests/live-smoke.test.ts` when `.env` has `APP_MODE=live`, a valid `DATABASE_URL` and `SESSION_SECRET`, and an available migrated PostgreSQL database. Otherwise the live test skips with a console reason. The live test creates disposable accounts and cleans all test-owned rows in `finally`, including after assertion failures; keep its cleanup and residue assertions intact. It uses an injected email delivery function and a local program snapshot, so it sends no real email and makes no Workout API request. See `docs/REFERENCE.md`’s PostgreSQL integration test instructions.

# Feature workflow

Review the relevant user flow and existing route, check the actual Workout API/SDK capability, model any local data, implement server authorization and validation, add UI states, then test the critical path.

# Commands

`pnpm install`, `pnpm db:generate`, `pnpm dev`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm db:migrate`. Set `APP_MODE=live`, `DATABASE_URL`, `SESSION_SECRET`, `WEB_ORIGIN`, and `WORKOUTAPI_KEY` for live mode; see `.env.example` and README. `pnpm db:seed` is opt-in and requires `SEED_DEMO_PASSWORD`.
