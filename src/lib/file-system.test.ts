import { describe, expect, it, vi } from "vitest";
import {
  ensureMarkdownExtension,
  getFilenameFromPath,
  pickMarkdownFilePath,
} from "./file-system";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("./file-system", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./file-system")>();
  return {
    ...actual,
    isTauriRuntime: () => true,
  };
});

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

describe("pickMarkdownFilePath", () => {
  it("pick_markdown_file invoke 결과를 반환한다", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockResolvedValueOnce("/Users/test/doc.md");

    const { pickMarkdownFilePath } = await import("./file-system");
    const result = await pickMarkdownFilePath();

    expect(invoke).toHaveBeenCalledWith("pick_markdown_file");
    expect(result).toBe("/Users/test/doc.md");
  });

  it("취소 시 null을 반환한다", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockResolvedValueOnce(null);

    const { pickMarkdownFilePath } = await import("./file-system");
    const result = await pickMarkdownFilePath();

    expect(result).toBeNull();
  });
});
