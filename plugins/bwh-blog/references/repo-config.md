# Repository path

Every `/bwh-blog:*` skill is launched via a `bun run` script in the monorepo's root `package.json` (e.g. `bun run blog:write-post`), so Claude Code always starts with the current working directory already set to the monorepo root. There is no saved config to read — use relative paths and plain `git` commands directly:

- Blog posts: `apps/website/src/content/blog/`
- Blog images: `apps/website/public/`
- Git commands: run normally (e.g. `git status`), no `-C` flag needed

## Sanity check

Before any file or git operation, confirm the working directory looks like the right repo:

- `apps/website/src/content/blog/` exists
- `apps/website/src/content.config.ts` exists

If either is missing, stop and tell the user to run the skill via the `bun run` script from the `bwh-monorepo` root (e.g. `bun run blog:write-post`) rather than starting Claude Code some other way.
