import { describe, expect, it } from "vitest";
import { convertClipboardToMarkdown } from "./paste";

describe("convertClipboardToMarkdown", () => {
  it("converts html content into markdown", () => {
    const markdown = convertClipboardToMarkdown({
      html: `
        <h1>Article Title</h1>
        <p>Read the <a href="https://example.com">source</a>.</p>
        <pre><code class="language-ts">const x = 1;\n</code></pre>
      `,
      text: null,
    });

    expect(markdown).toContain("# Article Title");
    expect(markdown).toContain("[source](https://example.com)");
    expect(markdown).toContain("```ts");
  });

  it("keeps details blocks as standard html toggles", () => {
    const markdown = convertClipboardToMarkdown({
      html: `
        <details open>
          <summary>More</summary>
          <p>Hidden body</p>
        </details>
      `,
      text: null,
    });

    expect(markdown).toContain("<details open");
    expect(markdown).toContain("<summary>More</summary>");
  });

  it("falls back to normalized plain text when html is unavailable", () => {
    const markdown = convertClipboardToMarkdown({
      html: null,
      text: "first line\r\n\r\n\r\nsecond line",
    });

    expect(markdown).toBe("first line\n\nsecond line");
  });

  it("converts simple html tables into markdown tables", () => {
    const markdown = convertClipboardToMarkdown({
      html: `
        <table>
          <tr><th>Name</th><th>Value</th></tr>
          <tr><td>Mode</td><td>Fast</td></tr>
        </table>
      `,
      text: null,
    });

    expect(markdown).toContain("| Name | Value |");
    expect(markdown).toContain("| --- | --- |");
    expect(markdown).toContain("| Mode | Fast |");
  });

  it("converts checkbox inputs into markdown task list markers", () => {
    const markdown = convertClipboardToMarkdown({
      html: `
        <ul>
          <li><input type="checkbox" checked />Done item</li>
          <li><input type="checkbox" />Todo item</li>
        </ul>
      `,
      text: null,
    });

    expect(markdown).toContain("- [x] Done item");
    expect(markdown).toContain("- [ ] Todo item");
  });

  it("drops unsafe javascript links while keeping text", () => {
    const markdown = convertClipboardToMarkdown({
      html: `<p><a href="javascript:alert('x')">Click me</a></p>`,
      text: null,
    });

    expect(markdown).toContain("Click me");
    expect(markdown).not.toContain("javascript:");
    expect(markdown).not.toContain("[Click me]");
  });
});
