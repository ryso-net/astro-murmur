import type { BlockContent, DefinitionContent } from "mdast";
import type { Custom, MdastNode, MdastPluginEntry, MdastVisitorContext } from "satteri";
import { CALLOUT_TYPES, type CalloutType, type Messages } from "../i18n/types";

type ContentNode = MdastNode | Custom;

interface ContainerDirectiveNode {
  type: "containerDirective";
  name: string;
  attributes?: Record<string, string | null | undefined> | null;
  children: Array<BlockContent | DefinitionContent>;
}

function isDirective(node: ContentNode): node is ContainerDirectiveNode {
  return node.type === "containerDirective" && "name" in node;
}

function hasDirectiveAncestor(
  parent: ReturnType<MdastVisitorContext["parent"]>,
  context: MdastVisitorContext,
): boolean {
  if (!parent) return false;
  return parent.type === "containerDirective" || hasDirectiveAncestor(context.parent(parent), context);
}

function text(value: string): Custom {
  return { type: "murmurText", value };
}

function element(
  tagName: string,
  classNames: string[],
  children: ContentNode[] = [],
  properties: Record<string, unknown> = {},
): Custom {
  const hProperties = { ...properties };
  if (classNames.length > 0) hProperties.className = classNames;

  return {
    type: "murmurElement",
    data: {
      hName: tagName,
      hProperties,
    },
    children,
  };
}

function calloutIcon(type: CalloutType): Custom {
  const shape = (tag: string, properties: Record<string, unknown>) => element(tag, [], [], properties);
  let children: Custom[];

  if (type === "warning" || type === "caution") {
    children = [
      shape("path", { d: "M10 2.5 1.8 16.7A1.4 1.4 0 0 0 3 18.8h14a1.4 1.4 0 0 0 1.2-2.1L10 2.5Z" }),
      shape("path", { d: "M10 7v4m0 3h.01" }),
    ];
  } else if (type === "info") {
    children = [
      shape("circle", { cx: 10, cy: 10, r: 8 }),
      shape("path", { d: "M10 9v5m0-9h.01" }),
    ];
  } else if (type === "danger" || type === "important") {
    children = [
      shape("circle", { cx: 10, cy: 10, r: 8 }),
      shape("path", { d: "M10 6v5m0 3h.01" }),
    ];
  } else if (type === "tip") {
    children = [
      shape("path", { d: "M7 15a6 6 0 1 1 6 0l-.8 2H7.8L7 15Zm1 5h4m-4-3h4" }),
    ];
  } else {
    children = [
      shape("path", { d: "M5 2.5h7l4 4v11H5z" }),
      shape("path", { d: "M12 2.5v4h4M8 10h5m-5 3h5" }),
    ];
  }

  return element("svg", ["callout-icon"], children, {
    viewBox: "0 0 20 20",
    ariaHidden: "true",
    focusable: "false",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  });
}

function attribute(node: ContainerDirectiveNode, name: string) {
  const value = node.attributes?.[name];
  return typeof value === "string" ? value.trim() : "";
}

function createDirectiveRenderer(messages: Messages) {
  let groupIndex = 0;

  function renderNode(node: ContentNode): ContentNode {
    if (!isDirective(node)) return node;

    if (node.name === "callout") {
      const rawType = attribute(node, "type").toLowerCase();
      const type = CALLOUT_TYPES.find((candidate) => candidate === rawType) ?? "note";
      const title = attribute(node, "title") || messages.calloutTitles[type];
      const children = node.children.map((child) => renderNode(child));

      return element("aside", ["callout", "callout--" + type], [
        element("p", ["callout-title"], [calloutIcon(type), element("strong", [], [text(title)])]),
        ...children,
      ], {
        role: "note",
        dataCalloutType: type,
      });
    }

    if (node.name === "details") {
      const title = attribute(node, "title") || messages.detailsSummary;
      const children = node.children.map((child) => renderNode(child));
      return element("details", ["content-details"], [
        element("summary", [], [text(title)]),
        ...children,
      ]);
    }

    if (node.name === "tabs") {
      const tabNodes = node.children.filter((child): child is ContainerDirectiveNode =>
        isDirective(child) && child.name === "tab"
      );
      if (tabNodes.length === 0) return node;

      const groupId = "murmur-tabs-" + (++groupIndex);
      const groupName = groupId + "-choice";
      const groupLabel = attribute(node, "label") || messages.tabsLabel;
      const entries: ContentNode[] = [];

      tabNodes.forEach((tab, index) => {
        const label = attribute(tab, "title") || messages.tabLabel.replace("{index}", String(index + 1));
        const tabId = groupId + "-tab-" + (index + 1);
        const panelId = groupId + "-panel-" + (index + 1);
        entries.push(element("div", ["tab-entry"], [
          element("input", ["tab-input"], [], {
            type: "radio",
            id: tabId,
            name: groupName,
            checked: index === 0,
            ariaControls: panelId,
          }),
          element("label", ["tab-label"], [text(label)], { htmlFor: tabId }),
          element("section", ["tab-panel"], tab.children.map((child) => renderNode(child as ContentNode)), {
            id: panelId,
            ariaLabelledBy: tabId,
          }),
        ]));
      });

      const extraContent = node.children
        .filter((child) => !(isDirective(child) && child.name === "tab"))
        .map((child) => renderNode(child));

      return element("fieldset", ["tabs"], [
        element("legend", ["tabs-title"], [text(groupLabel)]),
        ...entries,
        ...extraContent,
      ]);
    }

    return node;
  }

  return renderNode;
}

export function createContentDirectives(messages: Messages): MdastPluginEntry {
  return () => {
    const renderNode = createDirectiveRenderer(messages);

    return {
      name: "murmur-content-directives",
      containerDirective(node, context: MdastVisitorContext) {
        if (hasDirectiveAncestor(context.parent(node), context)) return;
        return renderNode(node);
      },
    };
  };
}
