---
description: Toggle draft status on a blog post (publish or unpublish). Use when the user wants to make a post live or hide it from production.
---

# Toggle blog post draft status

Change the `draft` field in a post's frontmatter.

## Input

Use `$ARGUMENTS` or ask the user for:

1. **Slug** — filename without `.md` (e.g. `welcome-to-builtwithhabit`)
2. **Action** — `publish` (set `draft: false`) or `unpublish` (set `draft: true`)

Example invocation: `/bwh-blog:toggle-draft welcome-to-builtwithhabit publish`

## Steps

1. Read `apps/website/src/content/blog/<slug>.md`
2. If the file does not exist, tell the user and stop
3. Edit the frontmatter:
   - `publish` → set `draft: false`
   - `unpublish` → set `draft: true`
4. Confirm the slug and new draft status to the user

## Notes

- `draft: true` posts are hidden on the live site but visible in local dev
- Publishing a post does not push to GitHub — the user must run `/bwh-blog:publish` next
