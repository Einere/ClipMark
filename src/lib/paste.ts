import TurndownService from "turndown";

export type ClipboardPayload = {
  html: string | null;
  text: string | null;
};

const PRESERVED_ATTRIBUTES = new Set([
  "alt",
  "href",
  "open",
  "src",
  "summary",
  "title",
]);

const REMOVED_SELECTORS = [
  "button",
  "form",
  "nav",
  "script",
  "select",
  "style",
  "textarea",
];

function normalizeMarkdown(markdown: string): string {
  return markdown
    .replace(/\r\n?/g, "\n")
    .replace(/^(\s*[-*+])\s+\\?\[(x| |X)\\?\]\s*/gm, "$1 [$2] ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitizeHtml(html: string): string {
  const document = new DOMParser().parseFromString(html, "text/html");

  document.querySelectorAll('input[type="checkbox"]').forEach((element) => {
    const marker = element.hasAttribute("checked") ? "[x] " : "[ ] ";
    element.replaceWith(document.createTextNode(marker));
  });

  REMOVED_SELECTORS.forEach((selector) => {
    document.querySelectorAll(selector).forEach((node) => node.remove());
  });

  document.querySelectorAll("input").forEach((node) => node.remove());

  document.querySelectorAll('a[href]').forEach((element) => {
    const href = element.getAttribute("href")?.trim() ?? "";
    if (href === "" || href.startsWith("javascript:")) {
      element.removeAttribute("href");
      return;
    }

    element.setAttribute("href", href);
  });

  document
    .querySelectorAll("span:empty, div:empty, p:empty")
    .forEach((node) => {
      node.remove();
    });

  document.querySelectorAll("*").forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      if (
        attribute.name.startsWith("on") ||
        (attribute.name === "class" &&
          element.tagName === "CODE" &&
          attribute.value.includes("language-"))
      ) {
        return;
      }

      if (
        (!PRESERVED_ATTRIBUTES.has(attribute.name) &&
          (attribute.name === "class" ||
            attribute.name === "id" ||
            attribute.name === "role" ||
            attribute.name === "style" ||
            attribute.name.startsWith("aria-") ||
            attribute.name.startsWith("data-")))
      ) {
        element.removeAttribute(attribute.name);
      }
    });
  });

  return document.body.innerHTML;
}

function createTurndownService() {
  const service = new TurndownService({
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
    headingStyle: "atx",
    strongDelimiter: "**",
  });

  service.keep(["details", "summary"]);

  service.addRule("tables", {
    filter(node: Node) {
      return node.nodeName === "TABLE";
    },
    replacement(_content: string, node: Node) {
      const table = node as HTMLTableElement;
      const rows = [...table.querySelectorAll("tr")].map((row) =>
        [...row.children].map((cell) => {
          const tableCell = cell as HTMLTableCellElement;
          return {
            colspan: tableCell.colSpan,
            rowspan: tableCell.rowSpan,
            text: tableCell.textContent?.trim().replace(/\|/g, "\\|") ?? "",
            type: tableCell.tagName.toLowerCase(),
          };
        }),
      );

      if (
        rows.length === 0 ||
        rows.some((row) =>
          row.some((cell) => cell.colspan > 1 || cell.rowspan > 1),
        )
      ) {
        return `\n\n${table.outerHTML}\n\n`;
      }

      const headerRow = rows[0];
      const bodyRows =
        headerRow.every((cell) => cell.type === "th") && rows.length > 1
          ? rows.slice(1)
          : rows;
      const headers = headerRow.map((cell) => cell.text || " ");
      const separator = headers.map(() => "---");

      return [
        "",
        `| ${headers.join(" | ")} |`,
        `| ${separator.join(" | ")} |`,
        ...bodyRows.map(
          (row) => `| ${row.map((cell) => cell.text || " ").join(" | ")} |`,
        ),
        "",
      ].join("\n");
    },
  });

  service.addRule("fencedCodeBlocks", {
    filter(node: Node) {
      return (
        node.nodeName === "PRE" &&
        node.firstChild !== null &&
        node.firstChild.nodeName === "CODE"
      );
    },
    replacement(_content: string, node: Node) {
      const codeElement = node.firstChild as HTMLElement | null;
      const className = codeElement?.getAttribute("class") ?? "";
      const language = /language-([\w-]+)/.exec(className)?.[1] ?? "";
      const code = codeElement?.textContent?.replace(/\n$/, "") ?? "";
      const fence = language ? `\`\`\`${language}` : "```";

      return `\n\n${fence}\n${code}\n\`\`\`\n\n`;
    },
  });

  service.addRule("strikethrough", {
    filter: ["del", "s", "strike"],
    replacement(content: string) {
      return `~~${content}~~`;
    },
  });

  return service;
}

export function getClipboardPayload(data: DataTransfer): ClipboardPayload {
  return {
    html: data.getData("text/html") || null,
    text: data.getData("text/plain") || null,
  };
}

export function convertClipboardToMarkdown(
  payload: ClipboardPayload,
): string | null {
  if (payload.html) {
    const sanitizedHtml = sanitizeHtml(payload.html);
    const service = createTurndownService();
    const markdown = service.turndown(sanitizedHtml);
    return normalizeMarkdown(markdown);
  }

  if (payload.text) {
    return normalizeMarkdown(payload.text);
  }

  return null;
}
