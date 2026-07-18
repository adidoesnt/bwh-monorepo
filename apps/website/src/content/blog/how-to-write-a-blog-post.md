---
title: "how to write a blog post"
description: "A step-by-step guide for adding a new post to the builtwithhabit blog by hand."
pubDate: 2026-07-05
tags:
  - guide
thumbnail:
  src: "/pillars-learn.jpg"
  alt: "Person reading and writing"
draft: true
---

Every blog post is a single markdown file. You add the file, open a pull request and once it is merged the site rebuilds and the post goes live.

## the easy way: use the blog plugin

If you have [Claude Code](https://code.claude.com) installed, you don't need to touch git or markdown by hand. From the `bwh-monorepo` root:

```bash
bun run blog:write-post
```

Paste your title, description, tags and body in chat (or point Claude at an existing draft file) and it saves the post as a draft for you. When you're ready:

```bash
bun run blog:toggle-draft
```

publishes or unpublishes a post — just give it the slug when asked. Then:

```bash
bun run blog:publish
```

commits and pushes the change to `main` for you, after showing you exactly what will be published and asking you to confirm. You never run a git command yourself.

The rest of this guide covers doing it by hand, if you'd rather have full control or don't have Claude Code set up.

## where to put your file

Create a new `.md` file here:

```
apps/website/src/content/blog/your-post-slug.md
```

The filename becomes the URL. A file named `your-post-slug.md` is published at `/blog/your-post-slug`.

Use lowercase words separated by hyphens. Pick a filename from your title:

| title | filename | URL |
| --- | --- | --- |
| Strength Training Basics | `strength-training-basics.md` | `/blog/strength-training-basics` |
| Why I Started Lifting | `why-i-started-lifting.md` | `/blog/why-i-started-lifting` |

The `title` in frontmatter can use normal capitalisation and spaces. Only the **filename** needs hyphens.

## copy this template

Start from the example below and replace each value with your own.

```md
---
title: "test post"
description: "Dummy post for testing the blog."
pubDate: 2026-07-05
tags:
  - test
thumbnail:
  src: "/pillars-learn.jpg"
  alt: "Test thumbnail"
draft: false
---

this is test content.

## test section

- item one
- item two

[link test](/training)
```

## frontmatter fields

The block between the `---` lines at the top is **frontmatter**. Every field is required except `draft`, which defaults to `false`.

| Field | What to put |
| --- | --- |
| `title` | The headline shown on the blog index and at the top of the post page. |
| `description` | A short summary. Shown on blog cards and used for search. Keep it to one or two sentences. |
| `pubDate` | Publish date in `YYYY-MM-DD` format. Posts are sorted newest first. |
| `tags` | At least one tag. Shown on cards and used for filtering on `/blog`. Use lowercase, e.g. `wellness`, `training`. |
| `thumbnail.src` | Path to the card image, starting with `/`. Files live in `apps/website/public/`. |
| `thumbnail.alt` | Short description of the image for accessibility. |
| `draft` | Set to `true` to work on a post without publishing it yet. **Important:** draft posts are only visible when running the site locally (`bun run dev` in `apps/website`). They do **not** appear on the live site after deploy. Set to `false` before merging to publish. |

## drafts vs published

> **Draft posts are visible in development only.**  
> While running `bun run dev`, any post with `draft: true` shows up on `/blog` and can be opened at its URL. The site also displays a **development mode** notice and a **draft** badge so you do not mistake a preview for a live post.  
> On the production site, draft posts are completely hidden — they are excluded from the blog index, search and individual post pages.

| `draft` value | Local dev (`bun run dev`) | Live site (after deploy) |
| --- | --- | --- |
| `true` | Visible — preview freely | **Hidden** |
| `false` | Visible | Visible |

To preview before publishing:

1. Set `draft: true` while writing.
2. Run `bun run dev` in `apps/website` and open `/blog/your-post-slug`.
3. When ready to go live, set `draft: false` and open your pull request.

## writing the body

Everything below the closing `---` is the post content. Standard markdown works:

- paragraphs
- `##` headings for sections
- bullet and numbered lists
- **bold** and *italic*
- links, e.g. `[training](/training)` for internal pages or full URLs for external sites

You do not need HTML. Keep headings to `##` and below — the page title is already rendered from `title`.

## thumbnails

1. Add your image to `apps/website/public/`, e.g. `public/my-post-cover.jpg`.
2. Reference it in frontmatter as `src: "/my-post-cover.jpg"`.

Existing images in `public/` (such as `/pillars-learn.jpg`) can be reused if you do not have a custom cover yet.

## checklist before opening a PR

1. File is in `apps/website/src/content/blog/`.
2. Filename is lowercase with hyphens and ends in `.md`.
3. All frontmatter fields are filled in.
4. At least one tag is set.
5. Thumbnail path points to an image in `public/`.
6. `draft` is `false` when you are ready to publish.
7. You have read the post once in the local dev site at `/blog/your-post-slug`.

## publishing

1. Create your markdown file on a branch.
2. Open a pull request.
3. After review and merge, the site deploys automatically and your post appears on `/blog`.

If something fails to build, check that dates, tags and thumbnail fields match the format in the template above.
