import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertSaveTargetAvailable,
  ensureMarkdownExtension,
  getFilenameFromPath,
} from "./file-system";

const { isDocumentPathOpenElsewhere } = vi.hoisted(() => ({
  isDocumentPathOpenElsewhere: vi.fn(),
}));

vi.mock("./document-window", () => ({
  isDocumentPathOpenElsewhere: (path: string) =>
    isDocumentPathOpenElsewhere(path),
}));

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

describe("assertSaveTargetAvailable", () => {
  beforeEach(() => {
    isDocumentPathOpenElsewhere.mockReset();
  });

  it("allows a target path that is not open elsewhere", async () => {
    isDocumentPathOpenElsewhere.mockResolvedValue(false);

    await expect(
      assertSaveTargetAvailable("/tmp/free.md"),
    ).resolves.toBeUndefined();
  });

  it("rejects a target path that is open in another window", async () => {
    isDocumentPathOpenElsewhere.mockResolvedValue(true);

    await expect(assertSaveTargetAvailable("/tmp/open.md")).rejects.toThrow(
      "That file is already open in another window.",
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
