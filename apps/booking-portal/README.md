# booking-portal

Client-facing portal for builtwithhabit — log in or sign up, then (eventually) request sessions, manage packages, and track progress. Built with SvelteKit 5, Tailwind v4 + daisyUI, and shared workspace packages.

## Stack

- **SvelteKit 2 / Svelte 5** (runes), Vite
- **Tailwind v4 + daisyUI**, theme (`builtwithhabit`) and shared styles from `@repo/tailwind-config`
- **`@repo/ui`** for shared components (e.g. `Button`)
- **`@repo/database`** for the drizzle/Postgres connection, schema, and the [better-auth](https://better-auth.com) instance (email/password auth)

## Local setup

1. Start Postgres (from the repo root):

   ```sh
   docker compose up -d
   ```

2. Copy/check `.env` — it should already have:

   ```sh
   DATABASE_URL="postgresql://bwh:bwh@localhost:5432/bwh"
   AUTH_BASE_URL="http://localhost:4322/"
   ```

   > This is the app's own runtime config — `src/lib/server/auth.ts` reads it via `$env/dynamic/private` and passes it into `@repo/database`. `packages/database` has a *separate* `.env` with just `DATABASE_URL`, used only by its standalone `drizzle-kit` CLI (`db:generate`/`migrate`/`push`/`studio`), which runs outside any SvelteKit app and can't read `$env`. The two aren't redundant — they're read by different code paths that happen to point at the same local Postgres.

3. Apply migrations (from the repo root):

   ```sh
   bun run db:migrate
   ```

4. Start the dev server:

   ```sh
   bun run dev
   # or from the repo root: bun run dev:portal
   ```

   Runs on [http://localhost:4322](http://localhost:4322).

## Auth

- `/` renders a combined login/signup form (mode toggled client-side) that posts to named SvelteKit form actions (`?/login`, `?/signup`) in `src/routes/+page.server.ts`. Input is validated with `zod`; auth is performed via `auth.api.signInEmail` / `auth.api.signUpEmail`.
- `src/hooks.server.ts` resolves the session on every request (`auth.api.getSession`), populates `event.locals.user`/`event.locals.session`, and redirects: unauthenticated users hitting `/dashboard` go to `/`, and already-logged-in users hitting `/` go to `/dashboard`.
- `src/lib/server/auth.ts` is the one place this app reads its own env (`DATABASE_URL`, `AUTH_BASE_URL`) and constructs the shared `createAuth(...)` instance from `@repo/database`.
- `/dashboard` is a minimal placeholder behind the auth gate, with a `logout` action.

## Scripts

| Command | Action |
| :-- | :-- |
| `bun run dev` | Start the dev server on port 4322 |
| `bun run build` | Build for production |
| `bun run preview` | Preview the production build |
| `bun run check` | Sync SvelteKit types and run `svelte-check` |

Database migrations (`db:generate` / `db:migrate` / `db:push` / `db:studio`) live in `packages/database` and are exposed at the repo root as `bun run db:*`.
