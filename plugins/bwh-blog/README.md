# builtwithhabit blog plugin

A [Claude Code plugin](https://code.claude.com/docs/en/plugins) that lets non-technical collaborators write and publish blog posts to the builtwithhabit website — no git knowledge required.

## One-time setup

1. **Install [Claude Code](https://code.claude.com)** and sign in.
2. **Clone this repo** somewhere on your machine (you don't need to know your way around it):
   ```bash
   git clone https://github.com/adidoesnt/bwh-monorepo
   cd bwh-monorepo
   ```

That's it — no separate configuration step. Every command below is a `bun run` script defined in the repo's root `package.json`, so it always runs from the right place.

## Daily workflow

Run these from inside your `bwh-monorepo` clone.

### 1. Write a post

```bash
bun run blog:write-post
```

Then either paste your title, description, tags and body in chat, or point Claude at an existing markdown draft file. New posts are saved as **drafts** and are not visible on the live site yet.

### 2. Make it live

```bash
bun run blog:toggle-draft
```

Claude will ask for the post's slug (its filename without `.md`) and whether to publish or unpublish it.

### 3. Publish to the live site

```bash
bun run blog:publish
```

Claude pulls the latest changes, shows you exactly what will be committed and asks you to confirm before pushing to `main`. You never run a git command yourself. Vercel deploys automatically once the push lands.

## Cheat sheet

| Goal | Command |
|------|---------|
| Write or import a post | `bun run blog:write-post` |
| Hide or show a post on the live site | `bun run blog:toggle-draft` |
| Push changes to GitHub | `bun run blog:publish` |

## Example prompts

**New post from scratch:**

> I want to write a blog post titled "why skin-safe activewear matters". Tags: wellness, activewear. Description: why we care about fabric choices. Body: [paste your text]

**Import an existing file:**

> Import `/Users/me/Documents/my-draft.md` as a blog post

**Publish:**

> `bun run blog:toggle-draft` (slug: `why-skin-safe-activewear-matters`, action: publish), then `bun run blog:publish`

## Post format

See `assets/post-template.md` and `references/frontmatter-schema.md` in this folder. Posts are stored at `apps/website/src/content/blog/<slug>.md`.

## Packaging the plugin

From the repo root:

```bash
bun run blog:package
```

This creates `plugins/bwh-blog.plugin` (gitignored). Distribute that file, or install/test it directly:

```bash
claude --plugin-dir ./plugins/bwh-blog.plugin
```

Bump `version` in `.claude-plugin/plugin.json` before packaging a new release.
