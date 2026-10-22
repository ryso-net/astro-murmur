import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const directory = fileURLToPath(new URL("../dist/", import.meta.url));
const limit = 7 * 1024;
let total = 0;
const inlineStyles = new Set<string>();
for (const file of await readdir(directory, { recursive: true })) {
  if (file.replaceAll("\\", "/").startsWith("pagefind/")) continue;
  if (file.endsWith(".html")) {
    const html = await readFile(join(directory, file), "utf8");
    for (const [, css] of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
      if (css.trim()) inlineStyles.add(css);
    }
    continue;
  }
  if (!file.endsWith(".css")) continue;
  const bytes = gzipSync(await readFile(join(directory, file))).length;
  total += bytes;
  console.log(`${file}: ${bytes} bytes gzip`);
}
// Shared inline styles repeat on every page; count each distinct block once.
for (const [index, css] of [...inlineStyles].entries()) {
  const bytes = gzipSync(css).length;
  total += bytes;
  console.log(`Inline CSS ${index + 1}: ${bytes} bytes gzip`);
}
console.log(`Theme CSS total: ${total} bytes gzip (${(total / 1024).toFixed(2)} KiB)`);
if (total > limit) {
  console.error(`Theme CSS exceeds the ${limit}-byte gzip budget by ${total - limit} bytes.`);
  process.exitCode = 1;
}
