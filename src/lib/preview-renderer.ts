import MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";
import markdownItTaskLists from "markdown-it-task-lists";
import {
  resolvePreviewUri,
  type ResolvedPreviewUri,
} from "./external-link";
import { slugifyHeading } from "./toc";

export type PreviewRenderInput = {
  filePath: string | null;
  isExternalMediaAutoLoadEnabled: boolean;
  markdown: string;
};

type PreviewNode =
  | {
      type: "element";
      tagName: string;
      properties: Record<string, string | boolean | string[]>;
      children: PreviewNode[];
    }
  | {
      type: "text";
      value: string;
    };

const ALLOWED_MARKDOWN_ELEMENTS = new Set([
  "a",
  "audio",
  "blockquote",
  "br",
  "code",
  "del",
  "details",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "img",
  "input",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "summary",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
  "video",
]);

const VOID_TAGS = new Set(["br", "hr", "img", "input"]);
const SOURCE_LINE_TAGS = new Set([
  "blockquote",
  "details",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "table",
  "ul",
]);

const markdownRenderer = new MarkdownIt({
  html: true,
  linkify: true,
})
  .use(markdownItTaskLists, {
    enabled: true,
    label: false,
    labelAfter: false,
  });

markdownRenderer.core.ruler.push("source-line-metadata", (state) => {
  for (const token of state.tokens) {
    attachSourceLineMetadata(token);
  }
});

function textNode(value: string): PreviewNode {
  return {
    type: "text",
    value,
  };
}

function elementNode(
  tagName: string,
  properties: Record<string, string | boolean | string[]> = {},
  children: PreviewNode[] = [],
): PreviewNode {
  return {
    type: "element",
    tagName,
    properties,
    children,
  };
}

function getTextContent(nodes: PreviewNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text") {
        return node.value;
      }

      return getTextContent(node.children);
    })
    .join("");
}

function createMediaCard(
  label: string,
  externalUri: string | null,
  sourceLineProperties: Record<string, string>,
): PreviewNode {
  return elementNode("span", {
    className: ["markdown-preview__media-card"],
    ...sourceLineProperties,
    ...(externalUri ? { "data-preview-uri": externalUri } : {}),
  }, [
    elementNode("span", {}, [textNode(label)]),
    elementNode("button", {
      className: ["ui-button"],
      "data-preview-open-uri": externalUri ?? "",
      "data-variant": "secondary",
      ...(externalUri ? {} : { disabled: true }),
      type: "button",
    }, [textNode("Open externally")]),
  ]);
}

function getExternalUri(rawUri: string | null | undefined, filePath: string | null) {
  if (!rawUri) {
    return null;
  }

  const resolved = resolvePreviewUri(rawUri, filePath);
  return resolved.kind === "external" ? resolved.uri : null;
}

function sanitizeLinkHref(
  href: string | null,
  filePath: string | null,
): ResolvedPreviewUri {
  if (!href) {
    return { kind: "invalid" };
  }

  return resolvePreviewUri(href, filePath);
}

function sanitizeDomNode(
  node: Node,
  input: PreviewRenderInput,
): PreviewNode[] {
  if (node.nodeType === Node.TEXT_NODE) {
    return [textNode(node.textContent ?? "")];
  }

  if (!(node instanceof Element)) {
    return [];
  }

  const tagName = node.tagName.toLowerCase();
  const sanitizedChildren = Array.from(node.childNodes).flatMap((child) =>
    sanitizeDomNode(child, input)
  );
  const sourceLineProperties = getSourceLineProperties(node);

  if (!ALLOWED_MARKDOWN_ELEMENTS.has(tagName)) {
    return sanitizedChildren;
  }

  if (tagName === "a") {
    const resolved = sanitizeLinkHref(node.getAttribute("href"), input.filePath);
    const externalUri = resolved.kind === "external" ? resolved.uri : null;

    return [elementNode("a", {
      ...sourceLineProperties,
      ...(externalUri ? {
        "data-preview-uri": externalUri,
        href: externalUri,
        rel: "noreferrer noopener",
        role: "link",
        tabindex: "0",
        target: "_blank",
      } : {}),
    }, sanitizedChildren)];
  }

  if (tagName === "img") {
    const externalUri = getExternalUri(node.getAttribute("src"), input.filePath);
    const alt = node.getAttribute("alt") ?? undefined;

    if (input.isExternalMediaAutoLoadEnabled && externalUri) {
      return [elementNode("img", {
        ...sourceLineProperties,
        ...(alt ? { alt } : {}),
        src: externalUri,
      })];
    }

    return [
      createMediaCard(
        alt?.trim() || "External media",
        externalUri,
        sourceLineProperties,
      ),
    ];
  }

  if (tagName === "video" || tagName === "audio") {
    const externalUri = getExternalUri(node.getAttribute("src"), input.filePath);

    if (input.isExternalMediaAutoLoadEnabled && externalUri) {
      return [elementNode(tagName, {
        ...sourceLineProperties,
        controls: true,
        src: externalUri,
      }, sanitizedChildren)];
    }

    return [
      createMediaCard(
        tagName === "video" ? "External video" : "External audio",
        externalUri,
        sourceLineProperties,
      ),
    ];
  }

  if (/^h[1-6]$/.test(tagName)) {
    return [elementNode(tagName, {
      ...sourceLineProperties,
      id: slugifyHeading(getTextContent(sanitizedChildren)),
    }, sanitizedChildren)];
  }

  if (tagName === "details") {
    return [elementNode("details", {
      ...sourceLineProperties,
      ...(node.hasAttribute("open") ? { open: true } : {}),
    }, sanitizedChildren)];
  }

  if (tagName === "input") {
    return [elementNode("input", {
      ...sourceLineProperties,
      ...(node.hasAttribute("checked") ? { checked: true } : {}),
      ...(node.hasAttribute("disabled") ? { disabled: true } : {}),
      readonly: true,
      ...(node.getAttribute("type") ? { type: node.getAttribute("type") ?? "text" } : {}),
    })];
  }

  return [elementNode(tagName, sourceLineProperties, sanitizedChildren)];
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replaceAll("\"", "&quot;");
}

function attachSourceLineMetadata(token: Token) {
  if (!token.map || !SOURCE_LINE_TAGS.has(token.tag)) {
    return;
  }

  const [lineStart, lineEnd] = token.map;
  token.attrSet("data-source-line-start", String(lineStart + 1));
  token.attrSet("data-source-line-end", String(Math.max(lineStart + 1, lineEnd)));
}

function getSourceLineProperties(element: Element) {
  const lineStart = element.getAttribute("data-source-line-start");
  const lineEnd = element.getAttribute("data-source-line-end");

  return {
    ...(lineStart ? { "data-source-line-start": lineStart } : {}),
    ...(lineEnd ? { "data-source-line-end": lineEnd } : {}),
  };
}

function serializeProperties(properties: Record<string, string | boolean | string[]>) {
  const attributes = Object.entries(properties).flatMap(([key, value]) => {
    if (value === false || value === "") {
      return [];
    }

    const attributeName = key === "className" ? "class" : key;
    if (value === true) {
      return [attributeName];
    }

    if (Array.isArray(value)) {
      return [`${attributeName}="${escapeAttribute(value.join(" "))}"`];
    }

    return [`${attributeName}="${escapeAttribute(value)}"`];
  });

  return attributes.length > 0 ? ` ${attributes.join(" ")}` : "";
}

function serializeNode(node: PreviewNode): string {
  if (node.type === "text") {
    return escapeHtml(node.value);
  }

  const openTag = `<${node.tagName}${serializeProperties(node.properties)}>`;
  if (VOID_TAGS.has(node.tagName)) {
    return openTag;
  }

  const childrenHtml = node.children.map((child) => serializeNode(child)).join("");
  return `${openTag}${childrenHtml}</${node.tagName}>`;
}

export function renderPreviewHtml(input: PreviewRenderInput) {
  const renderedHtml = markdownRenderer.render(input.markdown);
  const template = document.createElement("template");
  template.innerHTML = renderedHtml;

  return Array.from(template.content.childNodes)
    .flatMap((child) => sanitizeDomNode(child, input))
    .map((child) => serializeNode(child))
    .join("");
}
