import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDocumentFileActions } from "./useDocumentFileActions";
import type { OpenedDocument, SavedDocument } from "../lib/file-system";

const openMarkdownDocument = vi.fn();
const openMarkdownDocumentWithoutShowingWindow = vi.fn();
const saveMarkdownDocument = vi.fn();
const openRecentFile = vi.fn();

vi.mock("../lib/file-system", () => ({
  openMarkdownDocument: () => openMarkdownDocument(),
  openMarkdownDocumentWithoutShowingWindow: () => openMarkdownDocumentWithoutShowingWindow(),
  saveMarkdownDocument: (input: unknown) => saveMarkdownDocument(input),
}));

vi.mock("../lib/recent-files", () => ({
  openRecentFile: (path: string) => openRecentFile(path),
}));

type Controls = ReturnType<typeof useDocumentFileActions>;

function Harness({
  onReady,
  overrides,
}: {
  onReady: (controls: Controls) => void;
  overrides?: Partial<Parameters<typeof useDocumentFileActions>[0]>;
}) {
  const controls = useDocumentFileActions({
    activeFilePath: null,
    applyOpenedDocument: vi.fn(),
    applySavedDocument: vi.fn(),
    createNewDocument: vi.fn(),
    getMarkdown: () => "# Heading",
    isWelcomeVisible: false,
    onMissingRecentFile: vi.fn(),
    onRecentFileUnavailable: vi.fn(),
    ...overrides,
  });

  onReady(controls);
  return null;
}

describe("useDocumentFileActions", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let controls: Controls;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    openMarkdownDocument.mockReset();
    openMarkdownDocumentWithoutShowingWindow.mockReset();
    saveMarkdownDocument.mockReset();
    openRecentFile.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("falls back to the hidden file input when the picker returns nothing", async () => {
    const applyOpenedDocument = vi.fn();
    openMarkdownDocument.mockResolvedValue(null);

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          applyOpenedDocument,
        },
      }));
    });

    const click = vi.fn();
    controls.fileInputRef.current = { click } as unknown as HTMLInputElement;

    await act(async () => {
      await controls.openWithPicker();
    });

    expect(click).toHaveBeenCalledTimes(1);
    expect(applyOpenedDocument).not.toHaveBeenCalled();
  });

  it("reports unavailable recent files through the provided callbacks", async () => {
    const onMissingRecentFile = vi.fn();
    const onRecentFileUnavailable = vi.fn();
    openRecentFile.mockResolvedValue(null);

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          onMissingRecentFile,
          onRecentFileUnavailable,
        },
      }));
    });

    await act(async () => {
      await controls.loadRecentDocument("/tmp/missing.md");
    });

    expect(onRecentFileUnavailable).toHaveBeenCalledTimes(1);
    expect(onMissingRecentFile).not.toHaveBeenCalled();
  });

  it("saves the current markdown and applies the saved document metadata", async () => {
    const applySavedDocument = vi.fn();
    const createNewDocument = vi.fn();
    const savedDocument: SavedDocument = {
      filename: "saved.md",
      path: "/tmp/saved.md",
    };

    saveMarkdownDocument.mockResolvedValue(savedDocument);

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          activeFilePath: "/tmp/draft.md",
          applySavedDocument,
          createNewDocument,
          isWelcomeVisible: true,
        },
      }));
    });

    await act(async () => {
      await controls.saveDocument({ activeFilename: "draft.md" });
    });

    expect(createNewDocument).toHaveBeenCalledTimes(1);
    expect(saveMarkdownDocument).toHaveBeenCalledWith({
      filename: "draft.md",
      markdown: "# Heading",
      path: "/tmp/draft.md",
      saveAs: false,
    });
    expect(applySavedDocument).toHaveBeenCalledWith(savedDocument);
  });
});
