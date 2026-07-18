---
description: Create or update a blog post in apps/website/src/content/blog/. Use when the user wants to write, add, import, or edit a blog post from pasted content or an existing markdown file, or attaches a draft.
---

# Write blog post

Create or update a markdown file for the builtwithhabit blog. This skill only writes files — it never runs git commands. Publishing happens in `/bwh-blog:publish`.

## Repository path

Operate relative to the current working directory (the monorepo root). See `references/repo-config.md` for the sanity check to run first.

## Before writing

1. Read `references/frontmatter-schema.md` for the required fields.
2. Read `assets/post-template.md` for the file layout.
3. If updating an existing post rather than creating one, read the current file first and preserve fields the user didn't ask to change.

## Target location

Write **only** to `apps/website/src/content/blog/<slug>.md`. Never write blog content anywhere else in the repo.

## Slug rules

- Kebab-case filename: title "Why I Started Lifting" → `why-i-started-lifting.md`
- Derive the slug from the title unless the user specifies one
- Only `a-z`, `0-9` and hyphens
- If a file with that slug already exists and the user didn't say they're updating it, ask whether to overwrite, pick a new slug, or append a suffix

## Input modes

**Pasted content** — the user gives title, description, tags, body (and maybe an image) directly in chat. Ask for anything required that's missing rather than inventing it (title, description, at least one tag). It's fine to default `thumbnail` to an existing image under `apps/website/public/` if they have none.

**Existing file** — the user gives a path to a local `.md` file (or attaches one):
1. Read it
2. If it already has frontmatter, check it against `references/frontmatter-schema.md` and fix or ask about anything missing/invalid
3. If it has no frontmatter, treat the whole file as the body and ask for title/description/tags/thumbnail
4. Write the result to `apps/website/src/content/blog/<slug>.md`

**Image assets** — if the user provides a local image to use as the thumbnail, copy it into `apps/website/public/` (keep the original filename unless it collides, in which case ask) and set `thumbnail.src` to `/<filename>`.

## Frontmatter defaults

- `draft: true` for new posts, unless the user explicitly asks to publish immediately
- `pubDate`: today's date, unless the user specifies one
- Never invent a `tags` value out of thin air if the user gave none — ask for at least one

## After writing

Tell the user, in plain language:

1. The slug and file path created/updated
2. It's saved as a **draft** (invisible on the live site) until they run `/bwh-blog:toggle-draft <slug> publish`
3. They can preview locally, or move straight to `/bwh-blog:publish` if they want to save the draft to GitHub without making it live yet — the post only appears on the live site once both `draft: false` and the change is pushed
