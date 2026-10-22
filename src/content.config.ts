import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const posts = defineCollection({
  loader: glob({
    base: "./src/content/posts",
    pattern: "**/*.{md,mdx}",
    generateId: ({ entry }) => entry.replace(/\\/g, "/").replace(/\.(?:md|mdx)$/i, ""),
  }),
  schema: ({ image }) => z.object({
    title: z.string(),
    description: z.string().optional(),
    author: z.string().optional(),
    socialImage: image().optional(),
    socialImageAlt: z.string().optional(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    draft: z.boolean().default(false),
    tags: z.array(z.string().trim().min(1)).default([]),
  }),
});

const pages = defineCollection({
  loader: glob({ base: "./src/content/pages", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

const tags = defineCollection({
  loader: glob({
    base: "./src/content/tags",
    pattern: "**/*.{md,mdx}",
    generateId: ({ entry }) => entry.replace(/\\/g, "/").replace(/\.(?:md|mdx)$/i, ""),
  }),
  schema: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
  }),
});

export const collections = { posts, pages, tags };
