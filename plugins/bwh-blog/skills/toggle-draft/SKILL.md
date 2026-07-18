---
description: Toggle draft status on a blog post (publish or unpublish). Use when the user wants to make a post live or hide it from production.
---

# Toggle blog post draft status

Change the `draft` field in a post's frontmatter. This skill only edits the file — it never runs git commands. Pushing the change live happens in `/bwh-blog:publish`.

## Repository path

Operate relative to the current working directory (the monorepo root). See `references/repo-config.md` for the sanity check to run first.

## Input

From `$ARGUMENTS` or by asking:

1. **Slug** — the filename without `.md` (e.g. `why-i-started-lifting`)
2. **Action** — `publish` (set `draft: false`) or `unpublish` (set `draft: true`)

Example invocation: `/bwh-blog:toggle-draft why-i-started-lifting publish`

## Steps

1. Read `apps/website/src/content/blog/<slug>.md`. If it doesn't exist, tell the user and list the closest matching filenames you can find in that folder.
2. Edit only the `draft` field:
   - `publish` → `draft: false`
   - `unpublish` → `draft: true`
3. Confirm the slug and new draft status back to the user in plain language.

## Notes

- `draft: true` posts are hidden on the live site but visible when running the site locally
- This does not push anything to GitHub — remind the user to run `/bwh-blog:publish` next if they want the change to go live
