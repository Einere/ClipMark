import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppShellActions } from "./useAppShellActions";

type Controls = ReturnType<typeof useAppShellActions>;

function createSetterSpy() {
  return vi.fn();
}

function Harness({
  onReady,
  overrides,
}: {
  onReady: (controls: Controls) => void;
  overrides?: Partial<Parameters<typeof useAppShellActions>[0]>;
}) {
  const controls = useAppShellActions({
    activeFilename: "draft.md",
    canSaveDocument: true,
    createNewDocumentWindow: vi.fn().mockResolvedValue(undefined),
    filePath: "/tmp/draft.md",
    openWithPicker: vi.fn().mockResolvedValue(null),
    openRecentDocumentWindow: vi.fn().mockResolvedValue(undefined),
    saveDocument: vi.fn().mockResolvedValue(true),
    setIsExternalMediaAutoLoadEnabled: createSetterSpy(),
    setIsPreviewVisible: createSetterSpy(),
    setIsTocVisible: createSetterSpy(),
    setThemeMode: vi.fn(),
    showToast: vi.fn(),
    ...overrides,
  });

  onReady(controls);
  return null;
}

describe("useAppShellActions", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let controls: Controls;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it("forwards save requests with the active filename and saveAs flag", async () => {
    const saveDocument = vi.fn().mockResolvedValue(true);

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          saveDocument,
        },
      }));
    });

    await act(async () => {
      controls.handleMenuSave();
      controls.handleMenuSave(true);
    });

    expect(saveDocument).toHaveBeenNthCalledWith(1, {
      activeFilename: "draft.md",
      saveAs: false,
    });
    expect(saveDocument).toHaveBeenNthCalledWith(2, {
      activeFilename: "draft.md",
      saveAs: true,
    });
  });

  it("routes menu new and open recent actions through native document windows", async () => {
    const createNewDocumentWindow = vi.fn().mockResolvedValue(undefined);
    const openRecentDocumentWindow = vi.fn().mockResolvedValue(undefined);
    const openWithPicker = vi.fn().mockResolvedValue(null);

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          createNewDocumentWindow,
          openRecentDocumentWindow,
          openWithPicker,
        },
      }));
    });

    await act(async () => {
      controls.handleMenuNew();
      controls.handleMenuOpenRecent("/tmp/recent.md");
    });

    expect(createNewDocumentWindow).toHaveBeenCalledTimes(1);
    expect(openRecentDocumentWindow).toHaveBeenCalledWith("/tmp/recent.md");
    expect(openWithPicker).not.toHaveBeenCalled();
  });

  it("routes menu open through the document window picker", async () => {
    const openWithPicker = vi.fn().mockResolvedValue(null);

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          openWithPicker,
        },
      }));
    });

    await act(async () => {
      controls.handleMenuOpen();
    });

    expect(openWithPicker).toHaveBeenCalledTimes(1);
  });

  it("routes welcome new and open recent actions through native document windows", async () => {
    const createNewDocumentWindow = vi.fn().mockResolvedValue(undefined);
    const openRecentDocumentWindow = vi.fn().mockResolvedValue(undefined);
    const openWithPicker = vi.fn().mockResolvedValue(null);

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          createNewDocumentWindow,
          openRecentDocumentWindow,
          openWithPicker,
        },
      }));
    });

    await act(async () => {
      controls.handleWelcomeNew();
      controls.handleWelcomeOpenRecent("/tmp/recent.md");
    });

    expect(createNewDocumentWindow).toHaveBeenCalledTimes(1);
    expect(openRecentDocumentWindow).toHaveBeenCalledWith("/tmp/recent.md");
    expect(openWithPicker).not.toHaveBeenCalled();
  });

  it("routes welcome open through the document window picker", async () => {
    const openWithPicker = vi.fn().mockResolvedValue(null);

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          openWithPicker,
        },
      }));
    });

    await act(async () => {
      controls.handleWelcomeOpen();
    });

    expect(openWithPicker).toHaveBeenCalledTimes(1);
  });

  it("copies the current file path and reports success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn();
    vi.stubGlobal("navigator", {
      clipboard: { writeText },
    });

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          showToast,
        },
      }));
    });

    await act(async () => {
      await controls.handleMenuCopyFilePath();
    });

    expect(writeText).toHaveBeenCalledWith("/tmp/draft.md");
    expect(showToast).toHaveBeenCalledWith("Copied the file path to the clipboard.");
  });
});
