import mdx from "@astrojs/mdx";
import { satteri, satteriHeadingIdsPlugin } from "@astrojs/markdown-satteri";
import type { AstroIntegration } from "astro";
import { createContentDirectives } from "./utils/content-directives";
import { headingLinks } from "./utils/heading-links";
import { tableScroll } from "./utils/table-scroll";
import type { MurmurConfig } from "./config-schema";
import { getMessagesForLocale } from "./i18n/messages";

export default function murmurTheme(murmurConfig: MurmurConfig): AstroIntegration {
  return {
    name: "murmur-theme",
    hooks: {
      "astro:config:setup": ({ injectRoute, updateConfig }) => {
        const route = (pattern: string, file: string, prerender = true) => {
          injectRoute({
            pattern,
            entrypoint: new URL(`./pages/${file}`, import.meta.url),
            prerender,
          });
        };

        route("/archive", "archive/index.astro");
        route("/posts/[...slug]", "posts/[...slug].astro");
        route("/tags", "tags/index.astro");
        route("/tags/[tag]", "tags/[tag].astro");
        route("/[...route]", "[...route].astro");
        route("/[feed].xml", "[feed].xml.ts");
        route("/robots.txt", "robots.txt.ts");
        route("/404", "404.astro");

        updateConfig({
          site: murmurConfig.siteUrl || undefined,
          base: murmurConfig.basePath,
          output: "static",
          trailingSlash: "always",
          integrations: [mdx()],
          image: {
            layout: "constrained",
            responsiveStyles: true,
          },
          vite: {
            define: {
              __MURMUR_CONFIG__: JSON.stringify(murmurConfig),
            },
            build: {
              assetsInlineLimit: (filePath) => filePath.endsWith(".js") ? false : undefined,
              cssMinify: "lightningcss",
              cssTarget: ["chrome111", "edge111", "firefox114", "safari16.4", "ios16.4"],
              rolldownOptions: {
                output: { assetFileNames: "_astro/[hash][extname]" },
              },
            },
            environments: {
              client: {
                build: {
                  rolldownOptions: {
                    output: {
                      entryFileNames: "_astro/[hash].js",
                      chunkFileNames: "_astro/[hash].js",
                      assetFileNames: "_astro/[hash][extname]",
                    },
                  },
                },
              },
            },
          },
          markdown: {
            processor: satteri({
              features: { directive: true },
              mdastPlugins: [createContentDirectives(getMessagesForLocale(murmurConfig.i18n.locale)), tableScroll],
              hastPlugins: [satteriHeadingIdsPlugin(), headingLinks],
            }),
            syntaxHighlight: "shiki",
            shikiConfig: {
              themes: {
                light: "github-light",
                dark: "github-dark",
              },
            },
          },
          i18n: {
            defaultLocale: murmurConfig.i18n.locale,
            locales: [murmurConfig.i18n.locale],
            routing: {
              prefixDefaultLocale: false,
              redirectToDefaultLocale: false,
              fallbackType: "rewrite",
            },
          },
        });
      },
    },
  };
}
