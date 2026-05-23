import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNativeWindowState } from "./useNativeWindowState";

const {
  closeCurrentDocumentWindow,
  invoke,
  isFocused,
  isVisible,
  onCloseRequested,
  onFocusChanged,
  setFocus,
  showNativeWindow,
  logDebug,
} = vi.hoisted(() => ({
  invoke: vi.fn().mockResolvedValue(undefined),
  closeCurrentDocumentWindow: vi.fn().mockResolvedValue(undefined),
  showNativeWindow: vi.fn().mockResolvedValue(undefined),
  isFocused: vi.fn().mockResolvedValue(true),
  isVisible: vi.fn().mockResolvedValue(true),
  setFocus: vi.fn().mockResolvedValue(undefined),
  onCloseRequested: vi.fn(),
  onFocusChanged: vi.fn(),
  logDebug: vi.fn(),
}));

let closeHandler: ((event: { preventDefault: () => void }) => void | Promise<void>) | null = null;
let focusHandler: ((event: { payload: boolean }) => void) | null = null;

vi.mock("@tauri-apps/api/core", () => ({
  invoke,
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    isFocused,
    isVisible,
    onCloseRequested,
    onFocusChanged,
    setFocus,
  }),
}));

vi.mock("../lib/file-system", () => ({
  isTauriRuntime: () => true,
}));

vi.mock("../lib/document-window", () => ({
  closeCurrentDocumentWindow,
}));

vi.mock("../lib/native-window", () => ({
  showNativeWindow,
}));

vi.mock("../lib/debug-log", () => ({
  logDebug,
}));

function Harness({
  onReady,
  onRequestClose = () => undefined,
  onVisibilityChange,
}: {
  onReady?: (controls: ReturnType<typeof useNativeWindowState>) => void;
  onRequestClose?: () => void | Promise<void>;
  onVisibilityChange: (visible: boolean) => void;
}) {
  const controls = useNativeWindowState({
    filePath: null,
    isDirty: false,
    onRequestClose,
    onVisibilityChange,
    windowTitle: "ClipMark",
  });
  onReady?.(controls);
  return null;
}

describe("useNativeWindowState", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    closeHandler = null;
    focusHandler = null;
    invoke.mockClear();
    closeCurrentDocumentWindow.mockClear();
    isFocused.mockClear();
    isFocused.mockResolvedValue(true);
    isVisible.mockClear();
    isVisible.mockResolvedValue(true);
    onCloseRequested.mockReset();
    onCloseRequested.mockImplementation(async (handler) => {
      closeHandler = handler;
      return () => undefined;
    });
    onFocusChanged.mockReset();
    onFocusChanged.mockImplementation(async (handler) => {
      focusHandler = handler;
      return () => undefined;
    });
    setFocus.mockClear();
    showNativeWindow.mockClear();
    logDebug.mockClear();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("marks the window visible on initial mount and when focus is regained", async () => {
    const onVisibilityChange = vi.fn();

    await act(async () => {
      root.render(createElement(Harness, { onVisibilityChange }));
    });

    expect(onVisibilityChange).toHaveBeenCalledWith(true);

    await act(async () => {
      focusHandler?.({ payload: true });
    });

    expect(onVisibilityChange).toHaveBeenCalledTimes(2);
    expect(onVisibilityChange).toHaveBeenLastCalledWith(true);
  });

  it("does not mark the window hidden when focus is lost", async () => {
    const onRequestClose = vi.fn();
    const onVisibilityChange = vi.fn();

    await act(async () => {
      root.render(createElement(Harness, { onRequestClose, onVisibilityChange }));
    });

    onVisibilityChange.mockClear();

    await act(async () => {
      focusHandler?.({ payload: false });
    });

    expect(onVisibilityChange).not.toHaveBeenCalled();
  });

  it("exposes the current native window focus state", async () => {
    const onRequestClose = vi.fn();
    const onVisibilityChange = vi.fn();
    let controls!: ReturnType<typeof useNativeWindowState>;

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        onRequestClose,
        onVisibilityChange,
      }));
    });

    expect(controls.isFocused).toBe(true);

    await act(async () => {
      focusHandler?.({ payload: false });
    });

    expect(controls.isFocused).toBe(false);

    await act(async () => {
      focusHandler?.({ payload: true });
    });

    expect(controls.isFocused).toBe(true);
    expect(onVisibilityChange).toHaveBeenLastCalledWith(true);
  });

  it("uses the native window focus state on initial mount", async () => {
    const onRequestClose = vi.fn();
    const onVisibilityChange = vi.fn();
    let controls!: ReturnType<typeof useNativeWindowState>;

    isFocused.mockResolvedValueOnce(false);

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        onRequestClose,
        onVisibilityChange,
      }));
    });

    expect(isFocused).toHaveBeenCalledTimes(1);
    expect(controls.isFocused).toBe(false);
  });

  it("closes the current document window through the native adapter", async () => {
    const onVisibilityChange = vi.fn();
    let controls!: ReturnType<typeof useNativeWindowState>;

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        onVisibilityChange,
      }));
    });

    await act(async () => {
      await controls.closeWindow();
    });

    expect(closeCurrentDocumentWindow).toHaveBeenCalledTimes(1);
    expect(onVisibilityChange).not.toHaveBeenCalledWith(false);
  });

  it("allows a programmatic native close request to continue without preventing it", async () => {
    const onVisibilityChange = vi.fn();
    const preventDefault = vi.fn();
    let controls!: ReturnType<typeof useNativeWindowState>;

    closeCurrentDocumentWindow.mockImplementation(async () => {
      closeHandler?.({ preventDefault });
    });

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        onVisibilityChange,
      }));
    });

    await act(async () => {
      await controls.closeWindow();
    });

    expect(closeCurrentDocumentWindow).toHaveBeenCalledTimes(1);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("restores close request state and logs when the close request handler rejects", async () => {
    const closeError = new Error("close failed");
    const onRequestClose = vi.fn()
      .mockRejectedValueOnce(closeError)
      .mockResolvedValueOnce(undefined);
    const onVisibilityChange = vi.fn();

    await act(async () => {
      root.render(createElement(Harness, {
        onRequestClose,
        onVisibilityChange,
      }));
    });

    await act(async () => {
      closeHandler?.({ preventDefault: vi.fn() });
      await Promise.resolve();
    });

    await act(async () => {
      closeHandler?.({ preventDefault: vi.fn() });
      await Promise.resolve();
    });

    expect(onRequestClose).toHaveBeenCalledTimes(2);
    expect(logDebug).toHaveBeenCalledWith(
      `window:closeRequested failed ${String(closeError)}`,
    );
  });
});
