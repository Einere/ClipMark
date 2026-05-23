import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDocumentFileActions } from "./useDocumentFileActions";
import type { OpenedDocument, SavedDocument } from "../lib/file-system";

const openMarkdownDocument = vi.fn();
const openMarkdownDocumentWithoutShowingWindow = vi.fn();
const pickMarkdownDocumentPath = vi.fn();
const saveMarkdownDocument = vi.fn();
const openRecentFile = vi.fn();
const createDocumentWindow = vi.fn();
const openDocumentWindow = vi.fn();

vi.mock("../lib/file-system", () => ({
  openMarkdownDocument: () => openMarkdownDocument(),
  openMarkdownDocumentWithoutShowingWindow: () => openMarkdownDocumentWithoutShowingWindow(),
  pickMarkdownDocumentPath: () => pickMarkdownDocumentPath(),
  saveMarkdownDocument: (input: unknown) => saveMarkdownDocument(input),
}));

vi.mock("../lib/recent-files", () => ({
  openRecentFile: (path: string) => openRecentFile(path),
}));

vi.mock("../lib/document-window", () => ({
  createDocumentWindow: () => createDocumentWindow(),
  openDocumentWindow: (path: string) => openDocumentWindow(path),
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
    pickMarkdownDocumentPath.mockReset();
    saveMarkdownDocument.mockReset();
    openRecentFile.mockReset();
    createDocumentWindow.mockReset();
    openDocumentWindow.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("falls back to the hidden file input when the picker returns nothing", async () => {
    const applyOpenedDocument = vi.fn();
    pickMarkdownDocumentPath.mockResolvedValue(null);

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

  it("creates a new native document window instead of replacing the current document", async () => {
    const createNewDocument = vi.fn();

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          createNewDocument,
        },
      }));
    });

    await act(async () => {
      await controls.createNewDocumentWindow();
    });

    expect(createDocumentWindow).toHaveBeenCalledTimes(1);
    expect(createNewDocument).not.toHaveBeenCalled();
  });

  it("opens picker results through native document windows", async () => {
    const applyOpenedDocument = vi.fn();
    pickMarkdownDocumentPath.mockResolvedValue("/tmp/open.md");

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

    await act(async () => {
      await controls.openWithPicker();
    });

    expect(openDocumentWindow).toHaveBeenCalledWith("/tmp/open.md");
    expect(applyOpenedDocument).not.toHaveBeenCalled();
  });

  it("opens recent files through native document windows", async () => {
    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
      }));
    });

    await act(async () => {
      await controls.openRecentDocumentWindow("/tmp/recent.md");
    });

    expect(openDocumentWindow).toHaveBeenCalledWith("/tmp/recent.md");
    expect(openRecentFile).not.toHaveBeenCalled();
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
