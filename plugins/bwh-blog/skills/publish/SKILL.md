---
description: Commit and push blog content changes to GitHub. Use when the user is ready to publish blog posts to the remote repository.
disable-model-invocation: true
---

# Publish blog changes

Commit and push blog content to the remote repository.

## Scope

Stage **only** files under:

- `apps/website/src/content/blog/`
- `public/blog/` (if images were added there)

Do **not** stage unrelated changes. If `git status` shows other modified files, mention them but do not include them unless the user explicitly asks.

## Steps

1. Run `git status` and show the user what will be committed
2. Ask the user to confirm before proceeding
3. Pull the latest changes for the current branch: `git pull --rebase` (or `git pull` if rebase is not appropriate). If there are merge conflicts, stop and help the user resolve them before continuing
4. Stage blog files: `git add apps/website/src/content/blog/` (and `public/blog/` if needed)
5. Commit with a clear message:
   - New post: `blog: add <slug>`
   - Update: `blog: update <slug>`
   - Publish draft: `blog: publish <slug>`
6. Run `git push` to the current branch

## Guardrails

- **Never** use `git push --force`
- **Never** update git config
- **Never** skip hooks (`--no-verify`)
- Stop and report if there are merge conflicts
- If push fails, explain the error and suggest next steps

## After pushing

Tell the user that Vercel will deploy automatically and the post will appear on the live site once the deploy completes (if `draft: false` and `BLOG_ENABLED=true`).
