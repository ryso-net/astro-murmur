import type { SatteriProcessorOptions } from "@astrojs/markdown-satteri";

export const headingLinks: NonNullable<SatteriProcessorOptions["hastPlugins"]>[number] = {
  name: "murmur-heading-links",
  element: {
    filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
    visit(node, ctx) {
      const id = node.properties.id;
      if (typeof id !== "string") return;

      ctx.appendChild(node, {
        type: "element",
        tagName: "a",
        properties: {
          href: `#${encodeURIComponent(id)}`,
          className: ["heading-link"],
          ariaLabel: ctx.textContent(node),
        },
        // CSS supplies the symbol so it does not enter Astro's heading text.
        children: [],
      });
    },
  },
};
