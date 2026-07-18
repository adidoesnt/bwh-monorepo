# builtwithhabit blog plugin

A [Claude Code plugin](https://code.claude.com/docs/en/plugins) that lets non-technical collaborators write and publish blog posts to the builtwithhabit website — no git knowledge required.

## One-time setup

1. **Install [Claude Code](https://code.claude.com)** and sign in.
2. **Clone this repo** somewhere on your machine (you don't need to know your way around it):
   ```bash
   git clone https://github.com/adidoesnt/bwh-monorepo
   ```
3. **Start Claude Code with the plugin**, pointing at the clone:
   ```bash
   claude --plugin-dir /path/to/bwh-monorepo/plugins/bwh-blog
   ```
4. **Configure the repo path:**
   ```
   /bwh-blog:configure-repo /path/to/bwh-monorepo
   ```
   You can paste the path, or just tell Claude where you cloned it — you do not need to `cd` into the repo first.

Re-run `/bwh-blog:configure-repo` if you ever move the clone.

## Daily workflow

Start Claude Code with the plugin (from any directory):

```bash
claude --plugin-dir /path/to/bwh-monorepo/plugins/bwh-blog
```

### 1. Write a post

```
/bwh-blog:write-post
```

Then either paste your title, description, tags and body in chat, or point Claude at an existing markdown draft file. New posts are saved as **drafts** and are not visible on the live site yet.

### 2. Make it live

```
/bwh-blog:toggle-draft my-post-slug publish
```

Replace `my-post-slug` with your post's filename, without `.md`.

### 3. Publish to the live site

```
/bwh-blog:publish
```

Claude pulls the latest changes, shows you exactly what will be committed and asks you to confirm before pushing to `main`. You never run a git command yourself. Vercel deploys automatically once the push lands.

## Cheat sheet

| Goal | Command |
|------|---------|
| First-time setup | `/bwh-blog:configure-repo /path/to/bwh-monorepo` |
| Write or import a post | `/bwh-blog:write-post` |
| Hide a post from the live site | `/bwh-blog:toggle-draft my-slug unpublish` |
| Make a post live | `/bwh-blog:toggle-draft my-slug publish` |
| Push changes to GitHub | `/bwh-blog:publish` |

## Example prompts

**New post from scratch:**

> I want to write a blog post titled "why skin-safe activewear matters". Tags: wellness, activewear. Description: why we care about fabric choices. Body: [paste your text]

**Import an existing file:**

> Import `/Users/me/Documents/my-draft.md` as a blog post

**Publish:**

> `/bwh-blog:toggle-draft why-skin-safe-activewear-matters publish` then `/bwh-blog:publish`

## Post format

See `assets/post-template.md` and `references/frontmatter-schema.md` in this folder. Posts are stored at `apps/website/src/content/blog/<slug>.md`.

## Packaging the plugin

From the repo root:

```bash
bun run package:blog-plugin
```

This creates `plugins/bwh-blog.plugin` (gitignored). Distribute that file, or install/test it directly:

```bash
claude --plugin-dir ./plugins/bwh-blog.plugin
```

Bump `version` in `.claude-plugin/plugin.json` before packaging a new release.
