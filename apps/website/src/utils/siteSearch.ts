import {
  filterBlogPosts,
  sortBlogPosts,
  type BlogSearchablePost,
} from "./blogSearch";

export type SearchResultItem = {
  id: string;
  title: string;
  description: string;
  href: string;
};

export type SearchResultGroup = {
  id: string;
  label: string;
  results: SearchResultItem[];
};

export type SiteSearchSources = {
  blogPosts?: BlogSearchablePost[];
};

const DEFAULT_RESULTS_PER_GROUP = 5;

function searchBlogGroup(
  query: string,
  blogPosts: BlogSearchablePost[],
  limit: number,
): SearchResultGroup | null {
  const filtered = filterBlogPosts(blogPosts, { query });
  const sorted = sortBlogPosts(filtered, "newest");

  if (sorted.length === 0) {
    return null;
  }

  return {
    id: "blog",
    label: "blog",
    results: sorted.slice(0, limit).map((post) => ({
      id: post.slug,
      title: post.title,
      description: post.description,
      href: `/blog/${post.slug}`,
    })),
  };
}

export function searchSite(
  query: string,
  sources: SiteSearchSources,
  { resultsPerGroup = DEFAULT_RESULTS_PER_GROUP } = {},
): SearchResultGroup[] {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const groups: SearchResultGroup[] = [];

  if (sources.blogPosts?.length) {
    const blogGroup = searchBlogGroup(trimmedQuery, sources.blogPosts, resultsPerGroup);
    if (blogGroup) {
      groups.push(blogGroup);
    }
  }

  return groups;
}

export function hasSearchResults(groups: SearchResultGroup[]) {
  return groups.some((group) => group.results.length > 0);
}
