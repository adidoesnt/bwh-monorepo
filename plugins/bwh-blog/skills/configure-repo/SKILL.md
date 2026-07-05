---
description: One-time setup for publishing blog posts — set the monorepo path, verify git and GitHub access. Use when a collaborator is new, setup fails, or the repo location changed.
disable-model-invocation: true
---

# Configure repository

Set up where the builtwithhabit monorepo lives on this machine. Other plugin skills use this path — the session does **not** need to be started from the repo directory.

## Resolve the repo path

Determine the monorepo root using the first option that applies:

1. **`$ARGUMENTS`** — if the user passed a path (e.g. `/bwh-blog:configure-repo /Users/me/bwh-monorepo`)
2. **Path in chat** — if the user pasted or named a folder in the message
3. **Ask the user** — "Paste the full path to your bwh-monorepo folder, or tell me when you've selected it in Finder and I'll use that path."

Accept `~` in paths; expand to an absolute path before validating.

Do **not** assume the current working directory is the repo root.

## Validate the path

The path must be an existing directory containing:

- `apps/website/src/content/blog/`
- `apps/website/src/content.config.ts`

If validation fails, explain what's missing in plain language and ask for a different path.

## Save configuration

1. Create the config directory if needed: `mkdir -p ~/.config/bwh-blog`
2. Write the absolute repo path to: `~/.config/bwh-blog/repo-root` (one line, no extra text)

See `plugins/bwh-blog/references/repo-config.md` for how other skills use this file.

## Verify setup (run from the configured repo root)

Use `cd "{repoRoot}"` or `git -C "{repoRoot}"` for each check. Report results in plain language.

| Check | Command | If it fails |
|-------|---------|-------------|
| Claude Code | `claude --version` | Link to https://code.claude.com |
| Git installed | `git --version` | Ask user to install Xcode CLI tools or Git |
| Git identity | `git config user.name` and `user.email` | Ask for name/email; set **only with user confirmation**: `git config user.name "..."` and `git config user.email "..."` |
| Remote | `git remote -v` | Explain they need clone access to the GitHub repo |
| Fetch | `git fetch` (or `git pull --dry-run`) | Explain GitHub auth (SSH key, HTTPS, or `gh auth login`) |
| Current branch | `git branch --show-current` | Show branch; confirm it's where they should publish |
| Blog folder writable | list `apps/website/src/content/blog/` | Report error |

This skill **may** set `git config user.name` and `user.email` after explicit user confirmation. Other skills must not change git config.

## Do not configure

- `BLOG_ENABLED` or other deploy env vars (site owner only)
- Node, bun, or website dev dependencies (not required for publishing markdown)

## After setup

Tell the user:

1. Saved repo path and that other skills will use it automatically
2. How to start Claude Code with the plugin:
   ```bash
   claude --plugin-dir /path/to/bwh-monorepo/plugins/bwh-blog
   ```
   Or with a packaged plugin: `claude --plugin-dir /path/to/bwh-blog.plugin`
3. Next steps: `/bwh-blog:write-post`, then `/bwh-blog:toggle-draft`, then `/bwh-blog:publish`
