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
    filePath: "/tmp/draft.md",
    requestAction: vi.fn(),
    requestVisibleAction: vi.fn(),
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

  it("routes menu actions through visible action requests", async () => {
    const requestVisibleAction = vi.fn();

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          requestVisibleAction,
        },
      }));
    });

    await act(async () => {
      controls.handleMenuNew();
      controls.handleMenuOpen();
      controls.handleMenuOpenRecent("/tmp/recent.md");
    });

    expect(requestVisibleAction).toHaveBeenNthCalledWith(1, { type: "new" });
    expect(requestVisibleAction).toHaveBeenNthCalledWith(2, { type: "open" });
    expect(requestVisibleAction).toHaveBeenNthCalledWith(3, {
      path: "/tmp/recent.md",
      type: "openRecent",
    });
  });

  it("routes welcome actions through standard action requests", async () => {
    const requestAction = vi.fn();

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          requestAction,
        },
      }));
    });

    await act(async () => {
      controls.handleWelcomeNew();
      controls.handleWelcomeOpen();
      controls.handleWelcomeOpenRecent("/tmp/recent.md");
    });

    expect(requestAction).toHaveBeenNthCalledWith(1, { type: "new" });
    expect(requestAction).toHaveBeenNthCalledWith(2, { type: "open" });
    expect(requestAction).toHaveBeenNthCalledWith(3, {
      path: "/tmp/recent.md",
      type: "openRecent",
    });
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
