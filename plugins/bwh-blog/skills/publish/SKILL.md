---
description: Commit and push blog content changes straight to main on GitHub. Use when the user is ready to save or publish blog post changes — this is the only skill in this plugin that touches git.
disable-model-invocation: true
---

# Publish blog changes

Commit and push blog content to `main` on the remote repository. This is the **only** skill in this plugin that runs git commands — the collaborator should never need to run git themselves. Explain each step in plain language as you go; don't just print raw git output.

## Repository path

Operate relative to the current working directory (the monorepo root) and run plain `git` commands (no `-C` flag needed). See `references/repo-config.md` for the sanity check to run first.

## Scope

Stage **only**:

- `apps/website/src/content/blog/`
- `apps/website/public/` (only if this session added or changed an image there for a post)

Run `git status` first. If it shows changes outside this scope, point them out to the user but do not stage or commit them unless the user explicitly asks you to.

## Steps

1. **Check the branch.** `git branch --show-current`.
   - If it's `main`, continue.
   - If it's anything else: check whether there are uncommitted changes outside the blog scope above (`git status`). If there are none, switch with `git checkout main`. If there are unrelated changes, stop and explain the situation to the user instead of switching for them — this may be someone else's in-progress work.
2. **Sync with GitHub.** `git pull --ff-only origin main`.
   - If this fails because the branch has diverged in a way that isn't a fast-forward, stop and explain that someone else's changes conflict with local state and that you won't attempt a rebase/merge automatically — ask the user how they'd like to proceed (or suggest they get help).
3. **Show what will be published.** Run `git status` and `git diff -- apps/website/src/content/blog/ apps/website/public/` (or `--stat` for brevity if the diff is large). Summarize in plain language: which post(s), new vs. updated and current draft status of each.
4. **Confirm.** Ask the user to confirm before doing anything that touches the remote. Do not proceed without an explicit yes.
5. **Stage.** `git add apps/website/src/content/blog/` and, if relevant, `git add apps/website/public/<file>` for specific new images only — never a bare `add -A`.
6. **Commit** with a clear message reflecting what happened:
   - New post: `blog: add <slug>`
   - Content update: `blog: update <slug>`
   - Draft → live: `blog: publish <slug>`
   - Live → draft: `blog: unpublish <slug>`
7. **Push.** `git push origin main`.

## Guardrails

- Never use `git push --force` or `--force-with-lease`
- Never update git config
- Never skip hooks (`--no-verify`)
- Never rebase, merge, or otherwise rewrite history to force a push through — if `pull --ff-only` fails, stop and ask
- Never stage or commit anything outside the blog scope without the user explicitly asking

## After pushing

Tell the user, in plain language:

1. The push succeeded and what was published (slug(s), draft status)
2. Vercel will deploy automatically from `main`; the post will be visible on the live site once that finishes, provided `draft: false`
3. If a post is still `draft: true`, remind them it won't show on the live site until they run `/bwh-blog:toggle-draft <slug> publish` and publish again
