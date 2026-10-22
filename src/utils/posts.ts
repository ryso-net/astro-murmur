import type { CollectionEntry } from "astro:content";
import { murmurConfig } from "../config";
import { siteLocale, type Locale } from "../i18n/ui";
import { getContentIdentity } from "../i18n/content";

const postDateFormats = {
  withYear: new Intl.DateTimeFormat(siteLocale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }),
  withoutYear: new Intl.DateTimeFormat(siteLocale, {
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }),
};

export function formatPostDate(date: Date, showYear = true) {
  return postDateFormats[showYear ? "withYear" : "withoutYear"].format(date);
}

export function getPostSlug(post: CollectionEntry<"posts">) {
  return post.id.replace(/\\/g, "/").split("/").pop() ?? post.id;
}

export function getPostLocale(post: CollectionEntry<"posts">): Locale {
  return getContentIdentity(post.id).locale;
}

export function getPostsForSite(posts: CollectionEntry<"posts">[]) {
  const postsByContentId = new Map<string, CollectionEntry<"posts">[]>();

  for (const post of posts) {
    if (post.data.draft) continue;
    const contentId = getContentIdentity(post.id).id;
    const entries = postsByContentId.get(contentId) ?? [];
    if (entries.some((entry) => getPostLocale(entry) === getPostLocale(post))) {
      throw new Error(`More than one published post uses content path "${contentId}" for locale "${getPostLocale(post)}".`);
    }
    entries.push(post);
    postsByContentId.set(contentId, entries);
  }

  const fallbackLocale = murmurConfig.i18n.fallbackLocale;
  const localePriority = [...new Set<Locale>([
    siteLocale,
    fallbackLocale,
    ...(Object.keys(murmurConfig.navigation) as Locale[]),
  ])];

  const selectedPosts = [...postsByContentId.values()]
    .map((entries) =>
      localePriority
        .map((preferredLocale) => entries.find((post) => getPostLocale(post) === preferredLocale))
        .find((post) => post !== undefined),
    )
    .filter((post): post is CollectionEntry<"posts"> => post !== undefined)
    .sort((a, b) =>
      b.data.pubDate.getTime() - a.data.pubDate.getTime()
      || getPostSlug(a).localeCompare(getPostSlug(b), siteLocale),
    );

  const idsBySlug = new Map<string, string>();
  for (const post of selectedPosts) {
    const slug = getPostSlug(post);
    const contentId = getContentIdentity(post.id).id;
    const previousContentId = idsBySlug.get(slug);
    if (previousContentId && previousContentId !== contentId) {
      throw new Error(`Published posts "${previousContentId}" and "${contentId}" both use the URL slug "${slug}".`);
    }
    idsBySlug.set(slug, contentId);
  }

  return selectedPosts;
}
