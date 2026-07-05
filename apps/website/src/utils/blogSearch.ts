export type BlogSearchablePost = {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  pubDateIso: string;
};

export type BlogSortOrder = "newest" | "oldest";

export type BlogFilterOptions = {
  query?: string;
  tags?: string[];
};

export function filterBlogPosts<T extends BlogSearchablePost>(
  posts: T[],
  { query = "", tags = [] }: BlogFilterOptions = {},
): T[] {
  const normalizedQuery = query.trim().toLowerCase();
  const selectedTags = tags.filter(Boolean);

  return posts.filter((post) => {
    if (selectedTags.length > 0) {
      const hasTag = selectedTags.some((tag) => post.tags.includes(tag));
      if (!hasTag) {
        return false;
      }
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystack = [
      post.title,
      post.description,
      ...post.tags,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

export function sortBlogPosts<T extends BlogSearchablePost>(
  posts: T[],
  order: BlogSortOrder = "newest",
): T[] {
  return [...posts].sort((a, b) => {
    const aTime = new Date(a.pubDateIso).valueOf();
    const bTime = new Date(b.pubDateIso).valueOf();
    return order === "newest" ? bTime - aTime : aTime - bTime;
  });
}

export function paginateBlogPosts<T>(
  posts: T[],
  page: number,
  pageSize: number,
) {
  const totalPages = Math.max(1, Math.ceil(posts.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;

  return {
    items: posts.slice(start, start + pageSize),
    totalPages,
    currentPage,
    totalItems: posts.length,
  };
}

export function getUniqueTags<T extends BlogSearchablePost>(posts: T[]) {
  const tagSet = new Set<string>();
  for (const post of posts) {
    for (const tag of post.tags) {
      tagSet.add(tag);
    }
  }
  return [...tagSet].sort((a, b) => a.localeCompare(b));
}
