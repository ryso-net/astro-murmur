import { getCollection } from "astro:content";
import { getTagGroups, normalizeTagName } from "./tags";
import { getPostSlug, getPostsForSite } from "./posts";

export async function getPostStaticPaths() {
  const allPosts = await getCollection("posts");
  const posts = getPostsForSite(allPosts);
  const tagSlugByName = new Map(
    getTagGroups(posts).map(({ name, slug }) => [normalizeTagName(name), slug]),
  );

  return posts.map((post, index) => {
    const toPostLink = (entry: typeof post | undefined) => entry
      ? { slug: getPostSlug(entry), title: entry.data.title }
      : undefined;

    return {
      params: { slug: getPostSlug(post) },
      props: {
        post,
        previousPost: toPostLink(posts[index + 1]),
        nextPost: toPostLink(posts[index - 1]),
        tagSlugs: Object.fromEntries(
          post.data.tags.flatMap((tag) => {
            const normalizedTag = normalizeTagName(tag);
            const slug = tagSlugByName.get(normalizedTag);
            return slug ? [[normalizedTag, slug]] : [];
          }),
        ),
      },
    };
  });
}
