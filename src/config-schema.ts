export type Locale = "zh-CN" | "en";

export interface MurmurConfig {
  title: string;
  description: string;
  author: string;
  socialImage: string;
  siteUrl: string;
  basePath: string;
  recentPosts: {
    limit: number;
  };
  artalk: {
    server: string;
    site: string;
    options: Record<string, unknown>;
  };
  i18n: {
    locale: Locale;
    fallbackLocale: Locale;
  };
  pages: Readonly<Record<string, string>> & { home: "" };
  navigation: Readonly<Record<Locale, Readonly<Record<string, string>>>>;
}
