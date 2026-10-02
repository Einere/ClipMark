import { expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { normalizeDocumentFilename, renameMarkdownDocument } from "./file-system";
import { getRenamedDocumentWorkspaceState } from "./document-workspace-state";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

it("recovers the new save path when a completed rename reply is lost", async () => {
  vi.mocked(invoke).mockRejectedValueOnce(new Error("reply lost"))
    .mockResolvedValueOnce({ path: "/tmp/new.md" });
  await expect(renameMarkdownDocument({ path: "/tmp/old.md", filename: "new" }))
    .resolves.toEqual({ filename: "new.md", path: "/tmp/new.md" });
  vi.mocked(invoke).mockRejectedValueOnce(new Error("target exists"))
    .mockResolvedValueOnce({ path: "/tmp/old.md" });
  await expect(renameMarkdownDocument({ path: "/tmp/old.md", filename: "new" }))
    .rejects.toThrow("target exists");
});

it("renaming preserves dirty revision and editor identity", () => {
  const before = { editorDocumentKey: 7, filePath: "/tmp/old.md", filename: "old.md", savedRevision: 3, isWelcomeVisible: false };
  expect(getRenamedDocumentWorkspaceState(before, { filename: "new.md", path: "/tmp/new.md" }))
    .toEqual({ ...before, filename: "new.md", filePath: "/tmp/new.md" });
});

it("accepts a filename but rejects path and empty input", () => {
  expect(normalizeDocumentFilename(" 새 문서 ")).toBe("새 문서.md");
  for (const name of ["", " ", ".", "..", "../new", "a/b", "a\\b", "a\0b"]) {
    expect(() => normalizeDocumentFilename(name)).toThrow();
  }
});
