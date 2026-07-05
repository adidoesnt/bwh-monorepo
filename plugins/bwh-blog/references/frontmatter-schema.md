# Blog post frontmatter schema

All posts live at `apps/website/src/content/blog/<slug>.md`.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `title` | string | yes | Card heading and post `<h1>` |
| `description` | string | yes | Card excerpt and meta description |
| `pubDate` | date (YYYY-MM-DD) | yes | Sort newest-first on index |
| `tags` | string[] | yes (min 1) | Lowercase tags |
| `thumbnail.src` | string | yes | Path under `public/` (e.g. `/pillars-learn.jpg`) |
| `thumbnail.alt` | string | yes | Alt text for thumbnail |
| `draft` | boolean | no | Default `false`. `true` = hidden in production builds |

**Slug:** filename without `.md`, kebab-case (e.g. `welcome-to-builtwithhabit.md`).

**Production:** posts with `draft: true` are excluded from the live site. Drafts are visible in local dev.
