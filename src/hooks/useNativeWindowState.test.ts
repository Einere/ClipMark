import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNativeWindowState } from "./useNativeWindowState";

const {
  closeCurrentDocumentWindow,
  invoke,
  isVisible,
  onCloseRequested,
  onFocusChanged,
  setFocus,
  showNativeWindow,
} = vi.hoisted(() => ({
  invoke: vi.fn().mockResolvedValue(undefined),
  closeCurrentDocumentWindow: vi.fn().mockResolvedValue(undefined),
  showNativeWindow: vi.fn().mockResolvedValue(undefined),
  isVisible: vi.fn().mockResolvedValue(true),
  setFocus: vi.fn().mockResolvedValue(undefined),
  onCloseRequested: vi.fn(),
  onFocusChanged: vi.fn(),
}));

let closeHandler: ((event: { preventDefault: () => void }) => void | Promise<void>) | null = null;
let focusHandler: ((event: { payload: boolean }) => void) | null = null;

vi.mock("@tauri-apps/api/core", () => ({
  invoke,
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
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
  logDebug: vi.fn(),
}));

function Harness({
  onReady,
  onVisibilityChange,
}: {
  onReady?: (controls: ReturnType<typeof useNativeWindowState>) => void;
  onVisibilityChange: (visible: boolean) => void;
}) {
  const controls = useNativeWindowState({
    filePath: null,
    isDirty: false,
    onRequestClose: () => undefined,
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
    const onVisibilityChange = vi.fn();

    await act(async () => {
      root.render(createElement(Harness, { onVisibilityChange }));
    });

    onVisibilityChange.mockClear();

    await act(async () => {
      focusHandler?.({ payload: false });
    });

    expect(onVisibilityChange).not.toHaveBeenCalled();
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
});
