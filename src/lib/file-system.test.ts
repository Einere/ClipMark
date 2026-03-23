import { describe, expect, it } from "vitest";
import {
  ensureMarkdownExtension,
  getFilenameFromPath,
} from "./file-system";

describe("getFilenameFromPath", () => {
  it("extracts a filename from a unix path", () => {
    expect(getFilenameFromPath("/Users/einere/notes/example.md")).toBe(
      "example.md",
    );
  });

  it("extracts a filename from a windows path", () => {
    expect(getFilenameFromPath("C:\\Users\\einere\\example.md")).toBe(
      "example.md",
    );
  });
});

describe("ensureMarkdownExtension", () => {
  it("adds a markdown extension when the filename is missing one", () => {
    expect(ensureMarkdownExtension("archive-note")).toBe("archive-note.md");
  });

  it("keeps an existing supported extension", () => {
    expect(ensureMarkdownExtension("archive-note.markdown")).toBe(
      "archive-note.markdown",
    );
  });
});
