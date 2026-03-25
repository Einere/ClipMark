import { describe, expect, it } from "vitest";
import { renderPreviewHtml } from "./preview-renderer";

describe("renderPreviewHtml", () => {
  it("renders heading ids and external link attributes", () => {
    const html = renderPreviewHtml({
      filePath: "/tmp/docs/note.md",
      isExternalMediaAutoLoadEnabled: false,
      markdown: "# Heading Here\n\n[Docs](./reference.md)",
    });

    expect(html).toContain(
      "<h1 data-source-line-start=\"1\" data-source-line-end=\"1\" id=\"heading-here\">Heading Here</h1>",
    );
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
    expect(html).toContain("data-source-line-start=\"1\"");
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

  it("resolves relative media paths against the current file when auto-load is enabled", () => {
    const html = renderPreviewHtml({
      filePath: "/tmp/docs/note.md",
      isExternalMediaAutoLoadEnabled: true,
      markdown: "![Spec image](./assets/spec.png)",
    });

    expect(html).toContain("src=\"file:///tmp/docs/assets/spec.png\"");
  });

  it("renders task list inputs as readonly checkboxes", () => {
    const html = renderPreviewHtml({
      filePath: null,
      isExternalMediaAutoLoadEnabled: false,
      markdown: "- [x] Done\n- [ ] Pending",
    });

    expect(html).toContain("<input checked readonly type=\"checkbox\">");
    expect(html).toContain("<input readonly type=\"checkbox\">");
  });

  it("drops blocked links instead of exposing unsafe href attributes", () => {
    const html = renderPreviewHtml({
      filePath: null,
      isExternalMediaAutoLoadEnabled: false,
      markdown: "<a href=\"javascript:alert('x')\">Bad</a>",
    });

    expect(html).toContain("<a>Bad</a>");
    expect(html).not.toContain("href=");
    expect(html).not.toContain("data-preview-uri=");
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
