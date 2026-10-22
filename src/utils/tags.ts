import { getCollection, type CollectionEntry } from "astro:content";
import { siteLocale } from "../i18n/ui";
import { getPostsForSite } from "./posts";

export interface TagGroup {
  name: string;
  slug: string;
  posts: CollectionEntry<"posts">[];
}

export function normalizeTagName(tag: string) {
  return tag.trim().normalize("NFKC").toLocaleLowerCase(siteLocale);
}

function createTagSlug(tag: string) {
  const normalized = normalizeTagName(tag);
  const slug = normalized
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");

  if (slug) return slug;
  return `tag-${Array.from(normalized, (character) => character.codePointAt(0)!.toString(16)).join("-")}`;
}

export function getTagGroups(posts: CollectionEntry<"posts">[]): TagGroup[] {
  const groups = new Map<string, Omit<TagGroup, "slug">>();

  for (const post of posts) {
    const seenOnPost = new Set<string>();
    for (const value of post.data.tags) {
      const tag = value.trim();
      if (!tag) continue;
      const key = normalizeTagName(tag);
      if (seenOnPost.has(key)) continue;
      seenOnPost.add(key);
      const group = groups.get(key) ?? { name: tag, posts: [] };
      group.posts.push(post);
      groups.set(key, group);
    }
  }

  const usedSlugs = new Set<string>();
  return [...groups.values()]
    .sort((a, b) => a.name.localeCompare(b.name, siteLocale))
    .map((group) => {
      const baseSlug = createTagSlug(group.name);
      let slug = baseSlug;
      let suffix = 2;
      while (usedSlugs.has(slug)) slug = `${baseSlug}-${suffix++}`;
      usedSlugs.add(slug);
      return { ...group, slug };
    });
}

export async function getTagStaticPaths() {
  const [posts, tagPages] = await Promise.all([
    getCollection("posts"),
    getCollection("tags"),
  ]);
  const groups = getTagGroups(getPostsForSite(posts));
  const tagPagesBySlug = new Map(
    tagPages.map(({ id, data }) => [id, data] as const),
  );

  return groups.map(({ name, slug, posts }) => {
    const tagPage = tagPagesBySlug.get(slug);
    return {
      params: { tag: slug },
      props: {
        tag: name,
        posts,
        title: tagPage?.title,
        description: tagPage?.description,
      },
    };
  });
}
