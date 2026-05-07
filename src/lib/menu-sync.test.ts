import { describe, expect, it } from "vitest";
import { areRecentFilesEqual, cloneMenuState } from "./menu-sync";
import type { MenuState } from "./menu";

function createMenuState(): MenuState {
  return {
    canCopyFilePath: true,
    canSave: true,
    canTogglePanels: true,
    canUseEditMenu: true,
    canUseViewMenu: true,
    isExternalMediaAutoLoadEnabled: true,
    isPreviewVisible: true,
    isTocVisible: false,
    recentFiles: [{ filename: "note.md", path: "/tmp/note.md" }],
    themeMode: "dark",
  };
}

describe("menu-sync helpers", () => {
  it("compares recent files by filename and path", () => {
    expect(
      areRecentFilesEqual(
        [{ filename: "note.md", path: "/tmp/note.md" }],
        [{ filename: "note.md", path: "/tmp/note.md" }],
      ),
    ).toBe(true);

    expect(
      areRecentFilesEqual(
        [{ filename: "note.md", path: "/tmp/note.md" }],
        [{ filename: "draft.md", path: "/tmp/note.md" }],
      ),
    ).toBe(false);
  });

  it("clones recent files so later mutations do not leak into the snapshot", () => {
    const original = createMenuState();
    const snapshot = cloneMenuState(original);

    original.recentFiles[0]!.filename = "changed.md";

    expect(snapshot.recentFiles[0]!.filename).toBe("note.md");
  });
});
