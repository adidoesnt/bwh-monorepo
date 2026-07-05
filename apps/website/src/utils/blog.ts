import { getCollection } from "astro:content";

export { formatBlogDate, blogPostGridClass } from "./blogDisplay";

export async function getPublishedPosts() {
  const posts = await getCollection("blog");
  const visible = import.meta.env.PROD
    ? posts.filter((post) => !post.data.draft)
    : posts;
  return visible.sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );
}
