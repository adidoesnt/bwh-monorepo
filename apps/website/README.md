# website

The builtwithhabit marketing site and blog: [Astro](https://astro.build) for routing/rendering with [Svelte](https://svelte.dev) islands for interactive pieces, styled with Tailwind CSS v4 + daisyUI. Deployed on Vercel. This is one workspace inside the `bwh-monorepo` bun workspace, managed with [Turborepo](https://turbo.build).

## Project structure

```
src/
├── pages/            # routes: index, about, activewear, contact, training, blog/index, blog/[slug]
├── components/        # Astro + Svelte components (header, footer, cards, carousels, forms, ...)
├── layouts/            # shared page layout(s)
├── content/blog/       # blog post markdown files (see "Blog content" below)
├── constants/          # page copy plus env-derived config (feature flags, external links, email)
├── actions/            # Astro actions (contact form submission)
├── utils/               # blog listing/search helpers, email sending
└── styles/
```

`src/content.config.ts` defines the `blog` collection schema (`title`, `description`, `pubDate`, `tags`, `thumbnail`, `draft`).

## Commands

Run from the **monorepo root** unless noted:

| Command                          | Action                                             |
| :-------------------------------- | :-------------------------------------------------- |
| `bun install`                     | Install dependencies for all workspaces             |
| `bun run dev:website`             | Start this app's dev server at `localhost:4321`     |
| `bun run build`                   | Build all workspaces via Turborepo                  |
| `bun run lint`                    | Lint all workspaces via Turborepo                   |
| `bun run check-types`             | Type-check all workspaces via Turborepo             |

Scoped to this workspace only (run from `apps/website/`):

| Command          | Action                                              |
| :---------------- | :--------------------------------------------------- |
| `bun run dev`      | Start the dev server at `localhost:4321`             |
| `bun run build`    | Build the production site to `./dist/`                |
| `bun run preview`  | Preview the production build locally                 |
| `bun run astro ...`| Run Astro CLI commands, e.g. `bun run astro check`   |

## Environment variables

Set these in `.env` at this app's root (see AWS SES / Vercel for actual values):

| Variable | Purpose |
| :-- | :-- |
| `SES_SMTP_HOST`, `SES_SMTP_PORT`, `SES_SMTP_USER`, `SES_SMTP_PASS` | AWS SES SMTP credentials used by the contact form (`src/actions/contact.ts`) |
| `SENDER_EMAIL`, `RECEIVER_EMAIL` | From/to addresses for contact form emails |
| `SHOP_URL`, `PT_URL` | External links used in nav/header when the shop or booking portal are enabled |
| `SHOP_ENABLED`, `PT_ENABLED`, `BLOG_ENABLED`, `SEARCH_ENABLED` | Feature flags (`"true"` to enable); gate nav links and page sections |

## Blog content

Blog posts live at `src/content/blog/<slug>.md`. Non-technical collaborators can write and publish posts without touching git, using the `bwh-blog` Claude Code plugin — see `plugins/bwh-blog/README.md` and the in-repo guide at `src/content/blog/how-to-write-a-blog-post.md` for both the plugin-based and manual workflows.

## Tech stack notes

- **Rendering**: Astro with the Vercel adapter (`@astrojs/vercel`), server output.
- **Interactivity**: Svelte 5 components hydrated as Astro islands (`@astrojs/svelte`) — carousels, forms, FAQ accordions, etc.
- **Styling**: Tailwind CSS v4 + daisyUI, sharing config from `@repo/tailwind-config`; shared icons/UI primitives from `@repo/ui`.
- **Email**: `nodemailer` over AWS SES SMTP for the contact form.
