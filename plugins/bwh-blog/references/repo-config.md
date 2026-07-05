# Repository configuration

After `/bwh-blog:configure-repo` runs successfully, the monorepo root is saved to:

```
~/.config/bwh-blog/repo-root
```

The file contains a **single absolute path** (no trailing newline required), e.g.:

```
/Users/you/projects/bwh-monorepo
```

## Using the repo root in other skills

Before any file or git operation:

1. Read `~/.config/bwh-blog/repo-root`
2. If missing or the path no longer exists, tell the user to run `/bwh-blog:configure-repo` first
3. Resolve paths relative to that root:
   - Blog content: `{repoRoot}/apps/website/src/content/blog/`
   - Blog images (optional): `{repoRoot}/public/blog/`
4. Run git commands with `cd` to `{repoRoot}` (or `git -C "{repoRoot}" ...`)

## Valid monorepo markers

The configured path must contain:

- `apps/website/src/content/blog/` (directory)
- `apps/website/src/content.config.ts` (file)

Optional: `plugins/bwh-blog/` when working from a full clone.
