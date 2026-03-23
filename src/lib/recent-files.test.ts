import { beforeEach, describe, expect, it } from "vitest";
import {
  addRecentFile,
  clearRecentFiles,
  loadRecentFiles,
  removeRecentFile,
  saveRecentFiles,
} from "./recent-files";

describe("recent files", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("adds a recent file to the front and deduplicates by path", () => {
    const files = addRecentFile([], "/Users/einere/notes/one.md");
    const next = addRecentFile(files, "/Users/einere/notes/one.md");

    expect(next).toEqual([
      {
        filename: "one.md",
        path: "/Users/einere/notes/one.md",
      },
    ]);
  });

  it("loads recent files from local storage", () => {
    saveRecentFiles([
      {
        filename: "one.md",
        path: "/Users/einere/notes/one.md",
      },
    ]);

    expect(loadRecentFiles()).toEqual([
      {
        filename: "one.md",
        path: "/Users/einere/notes/one.md",
      },
    ]);
  });

  it("removes a recent file by path", () => {
    const files = addRecentFile([], "/Users/einere/notes/one.md");
    expect(removeRecentFile(files, "/Users/einere/notes/one.md")).toEqual([]);
  });

  it("clears all recent files", () => {
    saveRecentFiles([
      {
        filename: "one.md",
        path: "/Users/einere/notes/one.md",
      },
    ]);

    expect(clearRecentFiles()).toEqual([]);
    expect(loadRecentFiles()).toEqual([]);
  });
});
