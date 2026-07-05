---
description: Create or update a blog post in apps/website/src/content/blog/. Use when the user wants to write, add, import, or edit a blog post from pasted content or an existing markdown file.
---

# Write blog post

Create or update a markdown file for the builtwithhabit blog.

## Target location

Write **only** to:

```
apps/website/src/content/blog/<slug>.md
```

Never write blog content elsewhere in the repo.

## Before writing

1. Read `plugins/bwh-blog/references/frontmatter-schema.md` for required frontmatter fields.
2. Read `plugins/bwh-blog/assets/post-template.md` for the file format.
3. If updating an existing post, read the current file first.

## Slug rules

- Kebab-case filename: `my-post-title.md` → slug `my-post-title`
- Derive from title unless the user specifies a slug
- Use only `a-z`, `0-9`, and hyphens

## Frontmatter (required)

```yaml
---
title: "..."
description: "..."
pubDate: YYYY-MM-DD
tags:
  - tag-one
  - tag-two
thumbnail:
  src: "/pillars-learn.jpg"
  alt: "..."
draft: true
---
```

- **New posts:** default `draft: true` unless the user asks otherwise
- **pubDate:** use today's date for new posts unless specified
- **thumbnail:** default to `/pillars-learn.jpg` if the user has no image

## Input modes

### Mode A — pasted content

The user provides title, description, tags, and body in chat. Assemble the full `.md` file with frontmatter + body.

### Mode B — existing markdown file

The user provides a path to a local `.md` file (via `$ARGUMENTS` or in chat):

1. Read the file
2. Ensure frontmatter matches the schema (add or fix missing fields)
3. Write the result to `apps/website/src/content/blog/<slug>.md`

## After writing

Tell the user:

1. The file path and slug created
2. The post is a draft until they run `/bwh-blog:toggle-draft <slug> publish`
3. They can preview with the site dev server, or publish with `/bwh-blog:publish` after toggling draft off
