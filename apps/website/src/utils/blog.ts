import { getCollection } from "astro:content";

export async function getPublishedPosts() {
  const posts = await getCollection("blog");
  const visible = import.meta.env.PROD
    ? posts.filter((post) => !post.data.draft)
    : posts;
  return visible.sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );
}

export function formatBlogDate(date: Date) {
  return date.toLocaleDateString("en-SG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function blogPostGridClass(count: number) {
  const stretch = "items-stretch";
  if (count === 1) {
    return `grid w-full max-w-md grid-cols-1 gap-4 md:gap-8 ${stretch}`;
  }
  if (count === 2) {
    return `grid w-full max-w-4xl grid-cols-1 gap-4 md:grid-cols-2 md:gap-8 ${stretch}`;
  }
  return `grid w-full max-w-6xl grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 md:gap-8 ${stretch}`;
}
