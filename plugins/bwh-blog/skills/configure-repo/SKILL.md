---
description: One-time setup for publishing blog posts — locate the monorepo, verify git and GitHub access. Use when a collaborator is new, another skill reports it isn't configured, or the repo moved.
disable-model-invocation: true
---

# Configure repository

Locate the builtwithhabit monorepo on this machine and confirm the collaborator can publish through it. Other plugin skills depend on the path this skill saves — the session does **not** need to be started from inside the repo.

## Resolve the repo path

Determine the monorepo root using the first option that applies:

1. `$ARGUMENTS` — if the user passed a path, e.g. `/bwh-blog:configure-repo /Users/me/bwh-monorepo`
2. A path mentioned in chat
3. Ask: "Paste the full path to your bwh-monorepo folder. If you don't have a copy yet, tell me and I'll help you get one."

Expand `~` to an absolute path before validating. Do not assume the current working directory is the repo root.

If the user has no local clone at all, offer to run `git clone <remote-url>` into a location they choose (ask them where), rather than assuming a path.

## Validate the path

The path must be an existing directory containing:

- `apps/website/src/content/blog/`
- `apps/website/src/content.config.ts`

If validation fails, explain in plain language what's missing and ask for a different path.

## Save configuration

1. `mkdir -p ~/.config/bwh-blog`
2. Write the absolute repo path to `~/.config/bwh-blog/repo-root` (one line, nothing else)

See `references/repo-config.md` for how other skills use this file.

## Verify setup

Run each check with `git -C "{repoRoot}" ...` (do not `cd`). Report results in plain language, not raw command output.

| Check | Command | If it fails |
|-------|---------|-------------|
| Git installed | `git --version` | Ask the user to install Git (or Xcode CLI tools on macOS) |
| Git identity | `git config user.name` / `user.email` | Ask for their name and email; set them **only after explicit confirmation**: `git config user.name "..."` / `git config user.email "..."` |
| Remote configured | `git remote -v` | They need access to the GitHub repo — help them get the correct remote URL |
| Can reach remote | `git fetch` | Explain GitHub auth options (SSH key or `gh auth login`); do not attempt to fix auth yourself |
| Default branch | `git -C "{repoRoot}" branch --show-current` after checking out `main` | Posts are published straight to `main` (see `/bwh-blog:publish`) — make sure the collaborator understands this before continuing |
| Blog folder writable | list `apps/website/src/content/blog/` | Report the error |

This skill may set `git config user.name` / `user.email` after explicit user confirmation. No other skill in this plugin should touch git config.

## Out of scope

- `BLOG_ENABLED` or other deploy environment variables — site-owner only
- Installing Node/bun or website dependencies — not required just to publish markdown

## After setup

Tell the user:

1. The repo path that was saved, and that other `/bwh-blog:` skills will use it automatically from now on
2. What to do next: `/bwh-blog:write-post` to draft a post, then `/bwh-blog:publish` when ready to make it live
3. They will never need to run a `git` command themselves — the `publish` skill handles that
