import { getRelativeLocaleUrl } from "astro:i18n";
import { siteLocale } from "../i18n/ui";

export function localePath(path = "") {
  return getRelativeLocaleUrl(siteLocale, path.replace(/^\/+|\/+$/g, ""));
}

export function withBase(path: string) {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;

  return `${base}${path.replace(/^\/+/, "")}`;
}
