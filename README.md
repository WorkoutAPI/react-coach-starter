![React Coach Starter logo](public/logo.svg)

# React Coach Starter

**Your coaching workspace, ready to make your own.**

A white-label React starter for strength coaches and their clients, powered by [Workout API](https://workoutapi.com/).

[Try the demo](https://react-coach-starter.demo.workoutapi.com/) · [Run project locally](#try-it-in-demo-mode) · [Connect Workout API](#run-in-live-mode) · [Technical guide](docs/REFERENCE.md)

![Coach view of an assigned three-day strength program](assets/screenshots/coach-program.png)

_Coach program · fictional demo data_

## One product, two workspaces

<table width="100%">
  <tr>
    <th width="50%" align="left">For coaches<br><a href="assets/screenshots/coach-dashboard.png">Open full image ↗</a></th>
    <th width="50%" align="left">For clients<br><a href="assets/screenshots/client-dashboard.png">Open full image ↗</a></th>
  </tr>
</table>

![Coach dashboard on the left and client dashboard on the right, displayed at equal size](assets/screenshots/coach-client-workspaces.png)

**Coaches** invite clients, build and assign programs, and review training. **Clients** follow their plan, record sessions, and track progress. Both can keep conversations close to the work.

Programs come from the official [`@workoutapi/sdk`](https://www.npmjs.com/package/@workoutapi/sdk) in live mode. React Coach Starter keeps users, assignments, training history, and messages in PostgreSQL. Program snapshots preserve what was assigned to each client.

**Included:** coach and client authentication · private invitations · program generation and assignment · guided training and exercise logs · progress and exercise evolution · messaging and email notifications · responsive light and dark UI.

## Try it in demo mode

You need **Node.js 22+** and **pnpm 10**. The demo needs no account, database, or Workout API key.

```sh
corepack enable
pnpm install
cp .env.example .env
pnpm db:generate
pnpm dev
```

Open **http://localhost:3000** and enter as a coach or client. Demo screens use fictional data and local exercise illustrations; they make no Workout API or PostgreSQL requests. Demo changes are transient, and submitted training does not alter the sample history or statistics.

## Run in live mode

1. Get a key from your [Workout API account](https://workoutapi.com/).
2. Start PostgreSQL. For the optional local Docker database, run `docker compose up -d db`; or use an existing database and set its URL. The database must exist before migration. See the [PostgreSQL setup guide](docs/REFERENCE.md#postgresql-on-your-computer-no-docker) for local roles and port details.
3. Copy `.env.example` to `.env` if you have not already. Set these values:

   ```dotenv
   APP_MODE=live
   DATABASE_URL=postgresql://coach:coach@localhost:5432/coach?schema=public
   WORKOUTAPI_KEY=your-key
   SESSION_SECRET=replace-with-a-random-secret-of-at-least-32-characters
   WEB_ORIGIN=http://localhost:3000
   ```

   The database URL above matches the optional Docker service and the local development example. Use your own credentials for another database. Generate a secret with `openssl rand -hex 32`. Keep `.env` private.

4. Apply the schema and start the app:

   ```sh
   pnpm db:generate
   pnpm db:migrate
   pnpm dev
   ```

5. Register a coach, search the exercise library to verify the key, then invite a client and assign a program. Configure SMTP if you want invitation, recovery, and notification emails; see [environment variables](docs/REFERENCE.md#environment-variables).

**Existing pre-release database?** Read [Migration baseline](docs/REFERENCE.md#migration-baseline) _before_ running `pnpm db:migrate`. A fresh database applies `0_init` normally.

Live mode uses PostgreSQL and Workout API. If the service rejects a request or is unavailable, the app shows an error rather than substituting demo data. Workout API usage depends on your account permissions and service terms.

## White-label customization

Your main branding control is [`src/config/brand.ts`](src/config/brand.ts): change the product name, organization, support contact, logo URL, language defaults, and theme tokens. The starter's blue accent is `#3B82F6` (`primary` in the brand theme).

To replace the visual identity completely:

1. Update [`public/logo.svg`](public/logo.svg), then regenerate [`public/favicon.png`](public/favicon.png) and [`public/email-logo.png`](public/email-logo.png).
2. Keep the initial light and dark CSS colors in [`src/index.css`](src/index.css) in sync with `brand.theme`; update page-specific blue highlights too.
3. Replace product-specific English copy in [`src/i18n/en.ts`](src/i18n/en.ts). Email copy has separate English and French catalogs in `server/email/i18n/`.
4. Set your real support details, web origin, and SMTP sender before deployment.

See the full [branding instructions](docs/REFERENCE.md#white-label-customization), including the image generation commands and [interface language](docs/REFERENCE.md#interface-language) workflow.

## Training that works on mobile

[![Mobile guided training screen with a set log and finish-session button](assets/screenshots/mobile-training-centered.png)](assets/screenshots/mobile-training.png)

<p align="center"><em>Guided training on mobile · fictional demo data</em></p>

Clients can train through a program day in the app, logging repetitions and weight set by set as they go, moving between exercises, and resuming an unfinished session. Coaches can review completed days and individual logs together in the Progress timeline.

<details>
<summary>See the coach's progress view</summary>

![Coach progress timeline showing a client's guided sessions and exercise logs](assets/screenshots/coach-progress.png)

</details>

## Built with

React 19 · Vite · TypeScript · Tailwind CSS · Radix UI · Express · Prisma · PostgreSQL · [Workout API SDK](https://docs.workoutapi.com/sdk)

The [technical guide](docs/REFERENCE.md) covers the full feature flow, permissions, environment variables, email templates, SDK integration, deployment, and testing. Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` before shipping changes.

## License

React Coach Starter is free and open source under the [MIT License](LICENSE), including commercial use and rebranding. The code license does not grant rights to Workout API's hosted service, data, or trademarks. See [third-party notices](THIRD_PARTY_NOTICES.md).
