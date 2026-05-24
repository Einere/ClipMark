import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDocumentFileActions } from "./useDocumentFileActions";
import type { OpenedDocument, SavedDocument } from "../lib/file-system";

const openMarkdownDocument = vi.fn();
const pickMarkdownDocumentPath = vi.fn();
const saveMarkdownDocument = vi.fn();
const openRecentFile = vi.fn();
const createDocumentWindow = vi.fn();
const isDocumentPathOpenElsewhere = vi.fn();
const openDocumentWindow = vi.fn();

vi.mock("../lib/file-system", () => ({
  openMarkdownDocument: () => openMarkdownDocument(),
  pickMarkdownDocumentPath: () => pickMarkdownDocumentPath(),
  saveMarkdownDocument: (input: unknown) => saveMarkdownDocument(input),
}));

vi.mock("../lib/recent-files", () => ({
  openRecentFile: (path: string) => openRecentFile(path),
}));

vi.mock("../lib/document-window", () => ({
  createDocumentWindow: () => createDocumentWindow(),
  isDocumentPathOpenElsewhere: (path: string) =>
    isDocumentPathOpenElsewhere(path),
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
    pickMarkdownDocumentPath.mockReset();
    saveMarkdownDocument.mockReset();
    openRecentFile.mockReset();
    createDocumentWindow.mockReset();
    isDocumentPathOpenElsewhere.mockReset();
    isDocumentPathOpenElsewhere.mockResolvedValue(false);
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

  it("creates a new document in the current window when the welcome screen is visible", async () => {
    const createNewDocument = vi.fn();

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          createNewDocument,
          isWelcomeVisible: true,
        },
      }));
    });

    await act(async () => {
      await controls.createNewDocumentWindow();
    });

    expect(createNewDocument).toHaveBeenCalledTimes(1);
    expect(createDocumentWindow).not.toHaveBeenCalled();
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

  it("opens picker results in the current window when the welcome screen is visible", async () => {
    const document: OpenedDocument = {
      filename: "open.md",
      markdown: "# Open",
      path: "/tmp/open.md",
    };
    const applyOpenedDocument = vi.fn();
    pickMarkdownDocumentPath.mockResolvedValue("/tmp/open.md");
    openRecentFile.mockResolvedValue(document);

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          applyOpenedDocument,
          isWelcomeVisible: true,
        },
      }));
    });

    await act(async () => {
      await controls.openWithPicker();
    });

    expect(openRecentFile).toHaveBeenCalledWith("/tmp/open.md");
    expect(applyOpenedDocument).toHaveBeenCalledWith(document);
    expect(openDocumentWindow).not.toHaveBeenCalled();
  });

  it("focuses an existing document window instead of reusing welcome for an already-open picker path", async () => {
    const applyOpenedDocument = vi.fn();
    pickMarkdownDocumentPath.mockResolvedValue("/tmp/open.md");
    isDocumentPathOpenElsewhere.mockResolvedValue(true);

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          applyOpenedDocument,
          isWelcomeVisible: true,
        },
      }));
    });

    await act(async () => {
      await controls.openWithPicker();
    });

    expect(openDocumentWindow).toHaveBeenCalledWith("/tmp/open.md");
    expect(openRecentFile).not.toHaveBeenCalled();
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

  it("opens recent files in the current window when the welcome screen is visible", async () => {
    const document: OpenedDocument = {
      filename: "recent.md",
      markdown: "# Recent",
      path: "/tmp/recent.md",
    };
    const applyOpenedDocument = vi.fn();
    openRecentFile.mockResolvedValue(document);

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          applyOpenedDocument,
          isWelcomeVisible: true,
        },
      }));
    });

    await act(async () => {
      await controls.openRecentDocumentWindow("/tmp/recent.md");
    });

    expect(openRecentFile).toHaveBeenCalledWith("/tmp/recent.md");
    expect(applyOpenedDocument).toHaveBeenCalledWith(document);
    expect(openDocumentWindow).not.toHaveBeenCalled();
  });

  it("focuses an existing document window instead of reusing welcome for an already-open recent path", async () => {
    const applyOpenedDocument = vi.fn();
    isDocumentPathOpenElsewhere.mockResolvedValue(true);

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          applyOpenedDocument,
          isWelcomeVisible: true,
        },
      }));
    });

    await act(async () => {
      await controls.openRecentDocumentWindow("/tmp/recent.md");
    });

    expect(openDocumentWindow).toHaveBeenCalledWith("/tmp/recent.md");
    expect(openRecentFile).not.toHaveBeenCalled();
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
