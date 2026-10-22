import { defineConfig } from "astro/config";
import murmurTheme from "./src/integration";
import { murmurConfig } from "./murmur.config";

export default defineConfig({
  integrations: [murmurTheme(murmurConfig)],
});
