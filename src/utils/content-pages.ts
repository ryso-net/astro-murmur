import { getCollection, type CollectionEntry } from "astro:content";
import { murmurConfig } from "../config";
import { siteLocale } from "../i18n/ui";
import { getContentIdentity } from "../i18n/content";

export type ContentPageEntry = CollectionEntry<"pages">;

const reservedRoutes = new Set(["archive", "posts", "tags", "404", "robots.txt", "pagefind", "_astro", "_headers"]);
if (murmurConfig.siteUrl.trim()) {
  for (const route of ["rss.xml", "atom.xml", "sitemap.xml"]) reservedRoutes.add(route);
}

export async function getContentPageStaticPaths() {
  const pages = await getCollection("pages");
  const paths: {
    params: { route: string | undefined };
    props: {
      page: ContentPageEntry;
    };
  }[] = [];
  const seenRoutes = new Set<string>();

  if (!("home" in murmurConfig.pages)) {
    throw new Error('murmur.config.ts must include a "home" page route.');
  }
  if (murmurConfig.pages.home !== "") {
    throw new Error('The route for the "home" page must be an empty string.');
  }

  for (const [pageId, configuredRoute] of Object.entries(murmurConfig.pages)) {
    const route = configuredRoute.replace(/^\/+|\/+$/g, "");
    if (/[?#%\\\s]/u.test(route) || route.includes("//") || route.split("/").some((part) => part === "." || part === "..")) {
      throw new Error(`Invalid route "${configuredRoute}" for page "${pageId}".`);
    }
    if (seenRoutes.has(route)) {
      throw new Error(`More than one configured page uses route "${route}".`);
    }
    seenRoutes.add(route);

    const firstSegment = route.split("/")[0];
    if (reservedRoutes.has(firstSegment)) {
      throw new Error(`Route "${configuredRoute}" for page "${pageId}" is reserved.`);
    }

    const fallbackPage = pages.find((entry) => {
      const content = getContentIdentity(entry.id);
      return content.id === pageId && content.locale === murmurConfig.i18n.fallbackLocale;
    });
    if (!fallbackPage) {
      throw new Error(
        `Missing fallback-language content for "${pageId}" (${murmurConfig.i18n.fallbackLocale}) in src/content/pages/.`,
      );
    }

    const page = pages.find((entry) => {
      const content = getContentIdentity(entry.id);
      return content.id === pageId && content.locale === siteLocale && !entry.data.draft;
    }) ?? fallbackPage;
    if (page.data.draft) continue;

    paths.push({
      params: { route: route || undefined },
      props: { page },
    });
  }

  return paths;
}
