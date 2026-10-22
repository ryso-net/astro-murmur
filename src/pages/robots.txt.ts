import type { APIRoute } from "astro";
import { murmurConfig } from "../config";
import { withBase } from "../utils/paths";

export const GET: APIRoute = () => {
  const siteUrl = murmurConfig.siteUrl.trim();
  const sitemapLine = siteUrl
    ? `Sitemap: ${new URL(withBase("sitemap.xml"), siteUrl).toString()}`
    : "";
  const content = ["User-agent: *", "Allow: /", sitemapLine].filter(Boolean).join("\n") + "\n";

  return new Response(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
