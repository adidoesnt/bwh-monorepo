<script lang="ts">
  export type BlogPostCard = {
    slug: string;
    title: string;
    description: string;
    tags: string[];
    thumbnail: {
      src: string;
      alt: string;
    };
  };

  interface Props {
    posts: BlogPostCard[];
  }

  let { posts }: Props = $props();
</script>

{#each posts as post (post.slug)}
  <a href={`/blog/${post.slug}`}>
    <div
      class="bg-white flex h-full flex-col gap-4 rounded-sm p-4 shadow-md transition-all duration-300 hover:scale-105 hover:shadow-lg"
    >
      <div
        class="flex aspect-video items-center justify-center overflow-hidden rounded-sm"
      >
        <img
          src={post.thumbnail.src}
          alt={post.thumbnail.alt}
          class="h-full w-full object-cover"
        />
      </div>
      <h2
        class="font-headings text-dark-brown text-3xl font-bold tracking-wide"
      >
        {post.title}
      </h2>
      <hr class="border-dark-brown/60" />
      <p class="font-body text-dark-brown text-base">{post.description}</p>
      <div class="flex flex-wrap gap-2">
        {#each post.tags as tag (tag)}
          <span class="badge badge-neutral badge-sm font-body">{tag}</span>
        {/each}
      </div>
    </div>
  </a>
{/each}
