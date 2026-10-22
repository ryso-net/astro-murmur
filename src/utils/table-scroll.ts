import type { MdastPluginEntry } from "satteri";

export const tableScroll: MdastPluginEntry = {
  name: "murmur-table-scroll",
  table(node, context) {
    context.wrapNode(node, {
      type: "murmurElement",
      data: {
        hName: "div",
        hProperties: { className: ["table-scroll"] },
      },
      children: [],
    });
  },
};
