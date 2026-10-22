import { writeFile } from "node:fs/promises";
import { murmurConfig } from "../murmur.config.ts";

const basePath = murmurConfig.basePath.replace(/^\/+|\/+$/g, "");
const prefix = basePath ? `/${basePath}` : "";
const immutableAssets = [
  "_astro/*",
  "pagefind/*.pf_index",
  "pagefind/*.pf_fragment",
  "pagefind/*.pf_meta",
];

const headers = immutableAssets
  .map((path) => `${prefix}/${path}\n  Cache-Control: public, max-age=31536000, immutable`)
  .join("\n\n");

await writeFile(new URL("../dist/_headers", import.meta.url), `${headers}\n`);
