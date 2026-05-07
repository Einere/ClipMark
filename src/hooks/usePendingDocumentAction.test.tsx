import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePendingDocumentAction } from "./usePendingDocumentAction";

type Controls = ReturnType<typeof usePendingDocumentAction>;

function createDocument(path = "/tmp/recent.md") {
  return {
    filename: path.split("/").at(-1) ?? path,
    markdown: "# Heading",
    path,
  };
}

function Harness({
  onReady,
  overrides,
}: {
  onReady: (controls: Controls) => void;
  overrides?: Partial<Parameters<typeof usePendingDocumentAction>[0]>;
}) {
  const controls = usePendingDocumentAction({
    activeFilename: "draft.md",
    applyOpenedDocument: vi.fn(),
    createNewDocument: vi.fn(),
    ensureWindowVisible: vi.fn().mockResolvedValue(undefined),
    hideWindowAndResetDocument: vi.fn().mockResolvedValue(undefined),
    isDirty: false,
    isWindowVisible: true,
    loadRecentDocument: vi.fn().mockResolvedValue(null),
    onWindowVisibleChange: vi.fn(),
    openWithPicker: vi.fn().mockResolvedValue(null),
    openWithPickerWithoutShowingWindow: vi.fn().mockResolvedValue(null),
    saveDocument: vi.fn().mockResolvedValue(true),
    ...overrides,
  });

  onReady(controls);
  return null;
}

describe("usePendingDocumentAction", () => {
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
  });

  it("queues actions instead of performing them immediately when the document is dirty", async () => {
    const openWithPicker = vi.fn().mockResolvedValue(null);

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          isDirty: true,
          openWithPicker,
        },
      }));
    });

    await act(async () => {
      controls.requestAction({ type: "open" });
    });

    expect(openWithPicker).not.toHaveBeenCalled();
    expect(controls.pendingAction).toEqual({ type: "open" });
  });

  it("resolves queued close actions by saving and then hiding the window", async () => {
    const saveDocument = vi.fn().mockResolvedValue(true);
    const hideWindowAndResetDocument = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          hideWindowAndResetDocument,
          saveDocument,
        },
      }));
    });

    await act(async () => {
      controls.queuePendingAction({ type: "closeWindow" });
    });

    await act(async () => {
      await controls.resolvePendingActionWithSave();
    });

    expect(saveDocument).toHaveBeenCalledWith({ activeFilename: "draft.md" });
    expect(hideWindowAndResetDocument).toHaveBeenCalledTimes(1);
    expect(controls.pendingAction).toBeNull();
  });

  it("opens hidden recent documents and shows the window once the document is loaded", async () => {
    const document = createDocument();
    const applyOpenedDocument = vi.fn();
    const ensureWindowVisible = vi.fn().mockResolvedValue(undefined);
    const loadRecentDocument = vi.fn().mockResolvedValue(document);
    const onWindowVisibleChange = vi.fn();

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          applyOpenedDocument,
          ensureWindowVisible,
          isWindowVisible: false,
          loadRecentDocument,
          onWindowVisibleChange,
        },
      }));
    });

    await act(async () => {
      controls.requestVisibleAction({ path: document.path, type: "openRecent" });
      await Promise.resolve();
    });

    expect(loadRecentDocument).toHaveBeenCalledWith(document.path);
    expect(applyOpenedDocument).toHaveBeenCalledWith(document);
    expect(onWindowVisibleChange).toHaveBeenCalledWith(true);
    expect(ensureWindowVisible).toHaveBeenCalledTimes(1);
  });

  it("creates a new document immediately when the window is hidden", async () => {
    const createNewDocument = vi.fn();
    const ensureWindowVisible = vi.fn().mockResolvedValue(undefined);
    const onWindowVisibleChange = vi.fn();

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          createNewDocument,
          ensureWindowVisible,
          isWindowVisible: false,
          onWindowVisibleChange,
        },
      }));
    });

    await act(async () => {
      controls.requestVisibleAction({ type: "new" });
    });

    expect(createNewDocument).toHaveBeenCalledTimes(1);
    expect(onWindowVisibleChange).toHaveBeenCalledWith(true);
    expect(ensureWindowVisible).toHaveBeenCalledTimes(1);
  });
});
