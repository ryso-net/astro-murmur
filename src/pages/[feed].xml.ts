import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { murmurConfig } from "../config";
import { getMessages, siteLocale } from "../i18n/ui";
import { getContentPageStaticPaths } from "../utils/content-pages";
import { withBase } from "../utils/paths";
import { getPostSlug, getPostsForSite } from "../utils/posts";
import { getTagGroups } from "../utils/tags";

const siteUrl = murmurConfig.siteUrl.trim();
const absoluteUrl = (path: string) => new URL(withBase(path), siteUrl).toString();
const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

export function getStaticPaths() {
  return siteUrl
    ? [{ params: { feed: "rss" } }, { params: { feed: "atom" } }, { params: { feed: "sitemap" } }]
    : [];
}

export const GET: APIRoute = async ({ params }) => {
  const allPosts = await getCollection("posts");
  const posts = getPostsForSite(allPosts);

  if (params.feed === "rss") {
    const messages = getMessages();
    const channelDescription = murmurConfig.description || messages.description;
    const items = posts.map((post) => {
      const url = absoluteUrl(`posts/${getPostSlug(post)}/`);
      const author = post.data.author?.trim() || murmurConfig.author.trim();
      const categories = post.data.tags
        .map((tag) => `<category>${escapeXml(tag)}</category>`)
        .join("");
      const creator = author ? `<dc:creator>${escapeXml(author)}</dc:creator>` : "";
      const description = post.data.description || post.data.title;

      return [
        "<item>",
        `<title>${escapeXml(post.data.title)}</title>`,
        `<link>${escapeXml(url)}</link>`,
        `<guid isPermaLink="true">${escapeXml(url)}</guid>`,
        `<pubDate>${post.data.pubDate.toUTCString()}</pubDate>`,
        `<description>${escapeXml(description)}</description>`,
        creator,
        categories,
        "</item>",
      ].join("");
    }).join("");
    const lastBuildDate = posts[0]?.data.pubDate;

    return new Response(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
        "<channel>",
        `<title>${escapeXml(murmurConfig.title)}</title>`,
        `<link>${escapeXml(absoluteUrl(""))}</link>`,
        `<description>${escapeXml(channelDescription)}</description>`,
        `<language>${escapeXml(siteLocale)}</language>`,
        `<atom:link href="${escapeXml(absoluteUrl("rss.xml"))}" rel="self" type="application/rss+xml" />`,
        lastBuildDate ? `<lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>` : "",
        items,
        "</channel>",
        "</rss>",
      ].join(""),
      { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } },
    );
  }

  if (params.feed === "atom") {
    const channelDescription = murmurConfig.description || getMessages().description;
    const latestUpdate = posts.reduce((latest, post) => {
      const updated = post.data.updatedDate ?? post.data.pubDate;
      return updated > latest ? updated : latest;
    }, posts[0]?.data.updatedDate ?? posts[0]?.data.pubDate ?? new Date());
    const entries = posts.map((post) => {
      const url = absoluteUrl(`posts/${getPostSlug(post)}/`);
      const author = post.data.author?.trim() || murmurConfig.author.trim();
      const updated = post.data.updatedDate ?? post.data.pubDate;
      const authorElement = author ? `<author><name>${escapeXml(author)}</name></author>` : "";
      const categories = post.data.tags
        .map((tag) => `<category term="${escapeXml(tag)}" />`)
        .join("");

      return [
        "<entry>",
        `<title>${escapeXml(post.data.title)}</title>`,
        `<id>${escapeXml(url)}</id>`,
        `<link href="${escapeXml(url)}" rel="alternate" />`,
        `<published>${post.data.pubDate.toISOString()}</published>`,
        `<updated>${updated.toISOString()}</updated>`,
        `<summary>${escapeXml(post.data.description || post.data.title)}</summary>`,
        authorElement,
        categories,
        "</entry>",
      ].join("");
    });

    return new Response(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${escapeXml(siteLocale)}">`,
        `<title>${escapeXml(murmurConfig.title)}</title>`,
        `<subtitle>${escapeXml(channelDescription)}</subtitle>`,
        `<id>${escapeXml(absoluteUrl(""))}</id>`,
        `<updated>${latestUpdate.toISOString()}</updated>`,
        `<author><name>${escapeXml(murmurConfig.author.trim() || murmurConfig.title)}</name></author>`,
        `<link href="${escapeXml(absoluteUrl(""))}" rel="alternate" />`,
        `<link href="${escapeXml(absoluteUrl("atom.xml"))}" rel="self" type="application/atom+xml" />`,
        ...entries,
        "</feed>",
      ].join(""),
      { headers: { "Content-Type": "application/atom+xml; charset=utf-8" } },
    );
  }

  if (params.feed === "sitemap") {
    const routes = new Map<string, Date | undefined>();
    const pagePaths = await getContentPageStaticPaths();
    for (const { params: pageParams } of pagePaths) {
      routes.set(pageParams.route ? `${pageParams.route}/` : "", undefined);
    }

    routes.set("archive/", undefined);
    routes.set("tags/", undefined);
    for (const tag of getTagGroups(posts)) routes.set(`tags/${tag.slug}/`, undefined);
    for (const post of posts) {
      routes.set(`posts/${getPostSlug(post)}/`, post.data.updatedDate ?? post.data.pubDate);
    }

    const urls = [...routes].map(([path, lastmod]) => [
      "<url>",
      `<loc>${escapeXml(absoluteUrl(path))}</loc>`,
      lastmod ? `<lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>` : "",
      "</url>",
    ].join(""));

    return new Response(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...urls,
        "</urlset>",
      ].join(""),
      { headers: { "Content-Type": "application/xml; charset=utf-8" } },
    );
  }

  return new Response("Not found", { status: 404 });
};
