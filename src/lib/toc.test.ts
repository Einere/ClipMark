import { describe, expect, it } from "vitest";
import { extractHeadings, getActiveHeadingLine, slugifyHeading } from "./toc";

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

describe("getActiveHeadingLine", () => {
  const headings = [
    { depth: 1, id: "intro", line: 1, text: "Intro" },
    { depth: 2, id: "details", line: 5, text: "Details" },
    { depth: 2, id: "summary", line: 12, text: "Summary" },
  ];

  it("returns null when there is no current line", () => {
    expect(getActiveHeadingLine(headings, null)).toBeNull();
  });

  it("returns null when the cursor is before the first heading", () => {
    expect(getActiveHeadingLine(headings, 0)).toBeNull();
  });

  it("returns the most recent heading at or before the current line", () => {
    expect(getActiveHeadingLine(headings, 1)).toBe(1);
    expect(getActiveHeadingLine(headings, 4)).toBe(1);
    expect(getActiveHeadingLine(headings, 5)).toBe(5);
    expect(getActiveHeadingLine(headings, 20)).toBe(12);
  });
});
