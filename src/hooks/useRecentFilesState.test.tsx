import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRecentFilesState } from "./useRecentFilesState";
import type { RecentFile } from "../lib/recent-files";

const loadRecentFiles = vi.fn();
const addRecentFile = vi.fn();
const removeRecentFile = vi.fn();
const clearRecentFiles = vi.fn();

vi.mock("../lib/recent-files", () => ({
  addRecentFile: (files: RecentFile[], path: string | null) => addRecentFile(files, path),
  clearRecentFiles: () => clearRecentFiles(),
  loadRecentFiles: () => loadRecentFiles(),
  removeRecentFile: (files: RecentFile[], path: string) => removeRecentFile(files, path),
}));

function createRecentFile(path: string): RecentFile {
  return {
    filename: path.split("/").at(-1) ?? path,
    path,
  };
}

type HarnessProps = {
  onReady: (controls: ReturnType<typeof useRecentFilesState>) => void;
};

function Harness({ onReady }: HarnessProps) {
  const controls = useRecentFilesState();
  onReady(controls);
  return null;
}

describe("useRecentFilesState", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let controls: ReturnType<typeof useRecentFilesState>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    loadRecentFiles.mockReset();
    addRecentFile.mockReset();
    removeRecentFile.mockReset();
    clearRecentFiles.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("initializes from storage and appends remembered paths through the recent-file policy", async () => {
    const firstFile = createRecentFile("/tmp/alpha.md");
    const secondFile = createRecentFile("/tmp/beta.md");

    loadRecentFiles.mockReturnValue([firstFile]);
    addRecentFile.mockImplementation((files: RecentFile[], path: string | null) => {
      expect(files).toEqual([firstFile]);
      expect(path).toBe(secondFile.path);
      return [secondFile, ...files];
    });

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
      }));
    });

    expect(controls.recentFiles).toEqual([firstFile]);

    await act(async () => {
      controls.rememberRecentFile(secondFile.path);
    });

    expect(controls.recentFiles).toEqual([secondFile, firstFile]);
  });

  it("forgets and clears paths through the extracted recent-file state boundary", async () => {
    const firstFile = createRecentFile("/tmp/alpha.md");
    const secondFile = createRecentFile("/tmp/beta.md");

    loadRecentFiles.mockReturnValue([firstFile, secondFile]);
    removeRecentFile.mockImplementation((files: RecentFile[], path: string) => {
      expect(files).toEqual([firstFile, secondFile]);
      expect(path).toBe(firstFile.path);
      return [secondFile];
    });
    clearRecentFiles.mockReturnValue([]);

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
      }));
    });

    await act(async () => {
      controls.forgetRecentFile(firstFile.path);
    });

    expect(controls.recentFiles).toEqual([secondFile]);

    await act(async () => {
      controls.clearRecentFilesList();
    });

    expect(controls.recentFiles).toEqual([]);
  });
});
