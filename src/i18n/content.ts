import { murmurConfig } from "../config";
import type { Locale } from "./ui";

export function getContentIdentity(id: string): { locale: Locale; id: string } {
  const parts = id.replace(/\\/g, "/").replace(/\.(?:md|mdx)$/i, "").split("/");
  const locale = parts.length > 1
    ? (Object.keys(murmurConfig.navigation) as Locale[]).find(
        (candidate) => candidate.toLowerCase() === parts[0]?.toLowerCase(),
      )
    : undefined;

  return locale
    ? { locale, id: parts.slice(1).join("/") }
    : { locale: murmurConfig.i18n.fallbackLocale, id: parts.join("/") };
}
