# builtwithhabit blog plugin

A [Claude Code plugin](https://code.claude.com/docs/en/plugins) for writing and publishing blog posts to the builtwithhabit website — no Cursor required.

## One-time setup

1. **Install [Claude Code](https://code.claude.com)** and sign in
2. **Clone this repo** (anywhere on your machine)
3. **Load the plugin** and configure the repo path:

```bash
claude --plugin-dir /path/to/bwh-monorepo/plugins/bwh-blog
```

Then in Claude Code:

```
/bwh-blog:configure-repo /path/to/bwh-monorepo
```

You can paste the repo path or pass it as an argument — you do **not** need to `cd` into the repo first. Re-run configure if you move the clone.

Or add the plugin via your team's marketplace once configured.

## Daily workflow

Start Claude Code with the plugin (from any directory):

```bash
claude --plugin-dir /path/to/bwh-monorepo/plugins/bwh-blog
```

If you haven't configured yet, run `/bwh-blog:configure-repo` first with your repo path.

### 1. Write a post

```
/bwh-blog:write-post
```

Then either:
- Paste your title, description, tags, and body in chat, **or**
- Give the path to an existing markdown draft file

New posts are saved as **drafts** by default.

### 2. Make it live (remove draft status)

```
/bwh-blog:toggle-draft my-post-slug publish
```

Replace `my-post-slug` with your post's filename (without `.md`).

### 3. Push to GitHub

```
/bwh-blog:publish
```

Claude will pull the latest changes, show what will be committed, and ask you to confirm before pushing. Vercel deploys automatically after push.

## Cheat sheet

| Goal | Command |
|------|---------|
| First-time setup (repo path + git) | `/bwh-blog:configure-repo /path/to/bwh-monorepo` |
| Write or import a post | `/bwh-blog:write-post` |
| Hide a post from the live site | `/bwh-blog:toggle-draft my-slug unpublish` |
| Make a post live | `/bwh-blog:toggle-draft my-slug publish` |
| Push changes to GitHub | `/bwh-blog:publish` |

## Packaging the plugin

From the repo root:

```bash
bun run package:blog-plugin
```

This creates `plugins/bwh-blog.plugin` (gitignored). Install or test with:

```bash
claude --plugin-dir ./plugins/bwh-blog.plugin
```

Bump `version` in `.claude-plugin/plugin.json` before packaging a new release.

## Example prompts

**New post from scratch:**

> I want to write a blog post titled "why skin-safe activewear matters". Tags: wellness, activewear. Description: why we care about fabric choices. Body: [paste your text]

**Import an existing file:**

> Import `/Users/me/Documents/my-draft.md` as a blog post

**Publish:**

> `/bwh-blog:toggle-draft why-skin-safe-activewear-matters publish` then `/bwh-blog:publish`

## Post format

See `assets/post-template.md` and `references/frontmatter-schema.md` in this plugin folder.

Posts are stored at `apps/website/src/content/blog/<slug>.md`.
