<script lang="ts">
  import { onMount } from "svelte";
  import BlogPostCards, { type BlogPostCard } from "./blogPostCards.svelte";
  import {
    BLOG_POSTS_PER_PAGE,
    blogEmptyState,
    blogNoResultsState,
  } from "../constants/blog";
  import { blogPostGridClass } from "../utils/blogDisplay";
  import {
    filterBlogPosts,
    getUniqueTags,
    paginateBlogPosts,
    sortBlogPosts,
    type BlogSortOrder,
  } from "../utils/blogSearch";

  interface Props {
    posts: BlogPostCard[];
  }

  let { posts }: Props = $props();

  let searchTerm = $state("");
  let debouncedSearchTerm = $state("");
  let selectedTags = $state<string[]>([]);
  let sortOrder = $state<BlogSortOrder>("newest");
  let currentPage = $state(1);
  let debounceTimeout = $state<ReturnType<typeof setTimeout> | null>(null);
  let urlInitialized = $state(false);

  const availableTags = $derived(getUniqueTags(posts));

  const filteredPosts = $derived.by(() => {
    const filtered = filterBlogPosts(posts, {
      query: debouncedSearchTerm,
      tags: selectedTags,
    });
    return sortBlogPosts(filtered, sortOrder);
  });

  const pagination = $derived(
    paginateBlogPosts(filteredPosts, currentPage, BLOG_POSTS_PER_PAGE),
  );

  const gridClass = $derived(blogPostGridClass(pagination.items.length));

  function updateSearchTerm(value: string) {
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }

    searchTerm = value;
    debounceTimeout = setTimeout(() => {
      debouncedSearchTerm = value;
      currentPage = 1;
    }, 300);
  }

  function toggleTag(tag: string) {
    selectedTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    currentPage = 1;
  }

  function clearTags() {
    selectedTags = [];
    currentPage = 1;
  }

  function setSortOrder(order: BlogSortOrder) {
    sortOrder = order;
    currentPage = 1;
  }

  function goToPage(page: number) {
    currentPage = Math.min(Math.max(1, page), pagination.totalPages);
  }

  function readUrlState() {
    const params = new URLSearchParams(window.location.search);
    const query = params.get("q") ?? "";
    const tags = params.get("tag")?.split(",").filter(Boolean) ?? [];
    const sort = params.get("sort") === "oldest" ? "oldest" : "newest";
    const page = Number.parseInt(params.get("page") ?? "1", 10);

    searchTerm = query;
    debouncedSearchTerm = query;
    selectedTags = tags;
    sortOrder = sort;
    currentPage = Number.isNaN(page) || page < 1 ? 1 : page;
  }

  function writeUrlState() {
    const params = new URLSearchParams();

    if (debouncedSearchTerm.trim()) {
      params.set("q", debouncedSearchTerm.trim());
    }

    if (selectedTags.length > 0) {
      params.set("tag", selectedTags.join(","));
    }

    if (sortOrder === "oldest") {
      params.set("sort", "oldest");
    }

    if (currentPage > 1) {
      params.set("page", String(currentPage));
    }

    const queryString = params.toString();
    const nextUrl = queryString
      ? `${window.location.pathname}?${queryString}`
      : window.location.pathname;

    window.history.replaceState(null, "", nextUrl);
  }

  onMount(() => {
    readUrlState();
    urlInitialized = true;
  });

  $effect(() => {
    if (!urlInitialized) {
      return;
    }

    debouncedSearchTerm;
    selectedTags;
    sortOrder;
    currentPage;
    writeUrlState();
  });

  $effect(() => {
    filteredPosts.length;
    if (currentPage > pagination.totalPages) {
      currentPage = pagination.totalPages;
    }
  });
</script>

<div class="flex w-full max-w-6xl flex-col gap-4 md:gap-8">
  {#if posts.length > 0}
    <div class="flex w-full flex-col gap-4">
      <input
        class="input input-bordered bg-white rounded-sm w-full"
        type="search"
        value={searchTerm}
        oninput={(event) =>
          updateSearchTerm((event.currentTarget as HTMLInputElement).value)}
        placeholder="search posts…"
        aria-label="Search blog posts"
      />

      <div class="flex flex-wrap items-center gap-2">
        <span class="font-body text-dark-brown/80 text-sm">tags:</span>
        <button
          type="button"
          class="badge badge-sm font-body cursor-pointer transition-opacity {selectedTags.length ===
          0
            ? 'badge-neutral'
            : 'badge-outline opacity-70'}"
          onclick={clearTags}
        >
          all
        </button>
        {#each availableTags as tag (tag)}
          <button
            type="button"
            class="badge badge-sm font-body cursor-pointer transition-opacity {selectedTags.includes(
              tag,
            )
              ? 'badge-neutral'
              : 'badge-outline opacity-70'}"
            onclick={() => toggleTag(tag)}
          >
            {tag}
          </button>
        {/each}
      </div>

      <div class="flex flex-wrap items-center justify-between gap-4">
        <label class="font-body text-dark-brown flex items-center gap-2 text-sm">
          sort by date
          <select
            class="select select-bordered select-sm bg-white rounded-sm"
            value={sortOrder}
            onchange={(event) =>
              setSortOrder(
                (event.currentTarget as HTMLSelectElement).value as BlogSortOrder,
              )}
          >
            <option value="newest">newest first</option>
            <option value="oldest">oldest first</option>
          </select>
        </label>

        {#if pagination.totalPages > 1}
          <p class="font-body text-dark-brown/80 text-sm">
            page {pagination.currentPage} of {pagination.totalPages}
          </p>
        {/if}
      </div>
    </div>
  {/if}

  {#if posts.length === 0}
    <p class="font-body text-dark-brown text-center text-lg md:text-xl">
      {blogEmptyState}
    </p>
  {:else if pagination.items.length === 0}
    <p class="font-body text-dark-brown text-center text-lg md:text-xl">
      {blogNoResultsState}
    </p>
  {:else}
    <BlogPostCards posts={pagination.items} {gridClass} />
  {/if}

  {#if pagination.totalPages > 1}
    <div class="flex items-center justify-center gap-4">
      <button
        type="button"
        class="btn btn-sm btn-outline"
        disabled={pagination.currentPage <= 1}
        onclick={() => goToPage(pagination.currentPage - 1)}
      >
        previous
      </button>
      <button
        type="button"
        class="btn btn-sm btn-outline"
        disabled={pagination.currentPage >= pagination.totalPages}
        onclick={() => goToPage(pagination.currentPage + 1)}
      >
        next
      </button>
    </div>
  {/if}
</div>
