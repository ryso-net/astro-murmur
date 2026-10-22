import { rm } from "node:fs/promises";

// Keep the Component UI used by the lazy-loaded modal search; remove legacy UI assets.
const unusedPagefindAssets = [
  "pagefind-modular-ui.css",
  "pagefind-modular-ui.js",
  "pagefind-ui.css",
  "pagefind-ui.js",
  "pagefind-highlight.js",
];

await Promise.all(
  unusedPagefindAssets.map((asset) =>
    rm(new URL(`../dist/pagefind/${asset}`, import.meta.url), { force: true }),
  ),
);
