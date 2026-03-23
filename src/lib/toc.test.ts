import { describe, expect, it } from "vitest";
import { extractHeadings, slugifyHeading } from "./toc";

describe("slugifyHeading", () => {
  it("creates stable heading ids", () => {
    expect(slugifyHeading("Hello, ClipMark World")).toBe(
      "hello-clipmark-world",
    );
  });
});

describe("extractHeadings", () => {
  it("extracts markdown headings with depth and line numbers", () => {
    const markdown = `# Title

## Section
Body
`;

    expect(extractHeadings(markdown)).toEqual([
      { depth: 1, id: "title", line: 1, text: "Title" },
      { depth: 2, id: "section", line: 3, text: "Section" },
    ]);
  });

  it("ignores heading-like lines inside fenced code blocks", () => {
    const markdown = `# Title

\`\`\`md
## Not a heading
\`\`\`

## Real heading
`;

    expect(extractHeadings(markdown)).toEqual([
      { depth: 1, id: "title", line: 1, text: "Title" },
      { depth: 2, id: "real-heading", line: 7, text: "Real heading" },
    ]);
  });
});
