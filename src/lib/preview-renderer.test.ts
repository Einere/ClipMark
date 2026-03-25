import { describe, expect, it } from "vitest";
import { renderPreviewHtml } from "./preview-renderer";

describe("renderPreviewHtml", () => {
  it("renders heading ids and external link attributes", () => {
    const html = renderPreviewHtml({
      filePath: "/tmp/docs/note.md",
      isExternalMediaAutoLoadEnabled: false,
      markdown: "# Heading Here\n\n[Docs](./reference.md)",
    });

    expect(html).toContain("<h1 id=\"heading-here\">Heading Here</h1>");
    expect(html).toContain("href=\"file:///tmp/docs/reference.md\"");
    expect(html).toContain("data-preview-uri=\"file:///tmp/docs/reference.md\"");
  });

  it("renders external images as media cards when auto-load is disabled", () => {
    const html = renderPreviewHtml({
      filePath: null,
      isExternalMediaAutoLoadEnabled: false,
      markdown: "![Spec image](https://example.com/spec.png)",
    });

    expect(html).toContain("markdown-preview__media-card");
    expect(html).toContain("data-preview-open-uri=\"https://example.com/spec.png\"");
    expect(html).not.toContain("<img");
  });

  it("renders external media inline when auto-load is enabled", () => {
    const html = renderPreviewHtml({
      filePath: null,
      isExternalMediaAutoLoadEnabled: true,
      markdown: "![Spec image](https://example.com/spec.png)",
    });

    expect(html).toContain("src=\"https://example.com/spec.png\"");
    expect(html).toContain("alt=\"Spec image\"");
    expect(html).not.toContain("markdown-preview__media-card");
  });

  it("strips disallowed raw html while preserving allowed nodes", () => {
    const html = renderPreviewHtml({
      filePath: null,
      isExternalMediaAutoLoadEnabled: false,
      markdown: "<script>alert('x')</script><details open><summary>More</summary><p>Body</p></details>",
    });

    expect(html).not.toContain("<script");
    expect(html).toContain("<details open>");
    expect(html).toContain("<summary>More</summary>");
  });
});
