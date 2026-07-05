<script lang="ts">
  import { blogDraftBadgeLabel } from "../constants/blog";

  export type BlogPostCard = {
    slug: string;
    title: string;
    description: string;
    pubDateLabel: string;
    pubDateIso: string;
    tags: string[];
    thumbnail: {
      src: string;
      alt: string;
    };
    draft?: boolean;
  };

  interface Props {
    posts: BlogPostCard[];
    gridClass: string;
  }

  let { posts, gridClass }: Props = $props();
</script>

<div class={gridClass}>
  {#each posts as post (post.slug)}
    <a
      href={`/blog/${post.slug}`}
      class="bg-white grid h-full min-h-0 grid-rows-subgrid row-span-6 gap-4 rounded-sm p-4 shadow-md transition-all duration-300 hover:scale-105 hover:shadow-lg"
    >
      <div class="aspect-video overflow-hidden rounded-sm relative">
        <img
          src={post.thumbnail.src}
          alt={post.thumbnail.alt}
          class="h-full w-full object-cover"
        />
        {#if post.draft}
          <span
            class="badge badge-warning badge-sm font-body absolute top-2 right-2"
          >
            {blogDraftBadgeLabel}
          </span>
        {/if}
      </div>

      <h2
        class="font-headings text-dark-brown line-clamp-2 text-3xl font-bold tracking-wide"
      >
        {post.title}
      </h2>

      <time
        datetime={post.pubDateIso}
        class="font-body text-dark-brown/80 text-sm"
      >
        {post.pubDateLabel}
      </time>

      <hr class="border-dark-brown/60" />

      <p
        class="font-body text-dark-brown line-clamp-3 h-18 overflow-hidden text-base leading-6"
      >
        {post.description}
      </p>

      <div class="flex flex-wrap content-start gap-2">
        {#each post.tags as tag (tag)}
          <span class="badge badge-neutral badge-sm font-body">{tag}</span>
        {/each}
      </div>
    </a>
  {/each}
</div>
