# Blog post frontmatter schema

Source of truth: `apps/website/src/content.config.ts` (a Zod schema). Keep this file in sync if that schema changes.

All posts live at `apps/website/src/content/blog/<slug>.md`.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `title` | string | yes | Post headline, shown on the blog index card and the post's `<h1>` |
| `description` | string | yes | One or two sentence excerpt, shown on the card and used for search |
| `pubDate` | date (`YYYY-MM-DD`) | yes | Posts sort newest-first by this date |
| `tags` | string[] | yes, at least 1 | Lowercase, single words or hyphenated (e.g. `wellness`, `strength-training`) |
| `thumbnail.src` | string | yes | Path to an image under `apps/website/public/`, starting with `/` (e.g. `/pillars-learn.jpg`) |
| `thumbnail.alt` | string | yes | Alt text for the thumbnail image |
| `draft` | boolean | no, defaults to `false` | `true` hides the post on the live site (see below) |

**Slug:** the filename without `.md`, kebab-case (e.g. `why-skin-safe-activewear-matters.md`). Derive it from the title unless the user specifies one.

**Drafts:** a post with `draft: true` is visible when running the site locally (`bun run dev` in `apps/website`) but is completely excluded from the live site — the blog index, search and the post's own URL. Set `draft: false` to make a post live.

**Thumbnails:** if the user has no image of their own, reuse an existing file from `apps/website/public/` (e.g. `/pillars-learn.jpg`) rather than inventing a path that doesn't exist. If they give you an image file, copy it into `apps/website/public/` and reference it by its `/filename` path.
