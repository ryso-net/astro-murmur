import type { MurmurConfig } from "./src/config-schema";

const navigation = {
  "zh-CN": {
    "首页": "",
    "归档": "archive",
  },
  en: {
    Home: "",
    Archive: "archive",
  },
} as const satisfies Record<string, Record<string, string>>;

type Locale = keyof typeof navigation;

export const murmurConfig = {
  title: "Murmur",
  description: "",
  author: "",
  socialImage: "",
  siteUrl: "",
  basePath: "/",
  recentPosts: { limit: 5 },
  artalk: {
    server: "",
    site: "",
    options: {} satisfies Record<string, unknown>,
  },
  i18n: {
    locale: "zh-CN" as Locale,
    fallbackLocale: "zh-CN" as Locale,
  },
  pages: { home: "" },
  navigation,
} as const satisfies MurmurConfig;
