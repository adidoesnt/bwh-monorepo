# Repository configuration

After `/bwh-blog:configure-repo` runs successfully, the monorepo root is saved to:

```
~/.config/bwh-blog/repo-root
```

The file contains a single absolute path, no trailing newline required, e.g.:

```
/Users/you/projects/bwh-monorepo
```

## Using the repo root in other skills

Before any file or git operation:

1. Read `~/.config/bwh-blog/repo-root`.
2. If the file is missing, or the path it contains no longer exists, tell the user to run `/bwh-blog:configure-repo` first and stop.
3. Resolve paths relative to that root:
   - Blog posts: `{repoRoot}/apps/website/src/content/blog/`
   - Blog images: `{repoRoot}/apps/website/public/`
4. Run git commands with `-C "{repoRoot}"` (e.g. `git -C "{repoRoot}" status`) rather than `cd`-ing, so the skill works no matter what directory Claude Code was started from.

## Valid monorepo markers

The configured path must contain:

- `apps/website/src/content/blog/` (directory)
- `apps/website/src/content.config.ts` (file)
