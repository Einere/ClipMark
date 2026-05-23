import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppShellLifecycle } from "./useAppShellLifecycle";

const pendingActionControls = vi.hoisted(() => ({
  pendingAction: null,
  queuePendingAction: vi.fn(),
  resolvePendingActionWithDiscard: vi.fn(),
  resolvePendingActionWithSave: vi.fn(),
}));

const nativeWindowControls = vi.hoisted(() => ({
  closeWindow: vi.fn().mockResolvedValue(undefined),
  ensureWindowVisible: vi.fn().mockResolvedValue(undefined),
  handleEditorFocusChange: vi.fn(),
}));

const useWindowCloseRequestMock = vi.hoisted(() => vi.fn());
const useNativeWindowStateMock = vi.hoisted(() => vi.fn());
const usePendingDocumentActionMock = vi.hoisted(() => vi.fn());

vi.mock("./useWindowCloseRequest", () => ({
  useWindowCloseRequest: useWindowCloseRequestMock,
}));

vi.mock("./useNativeWindowState", () => ({
  useNativeWindowState: useNativeWindowStateMock,
}));

vi.mock("./usePendingDocumentAction", () => ({
  usePendingDocumentAction: usePendingDocumentActionMock,
}));

function Harness({
  onReady,
  overrides,
}: {
  onReady: (controls: ReturnType<typeof useAppShellLifecycle>) => void;
  overrides?: Partial<Parameters<typeof useAppShellLifecycle>[0]>;
}) {
  const controls = useAppShellLifecycle({
    filePath: "/tmp/draft.md",
    filename: "draft.md",
    isDirty: false,
    isWelcomeVisible: false,
    saveDocument: vi.fn().mockResolvedValue(true),
    ...overrides,
  });

  onReady(controls);
  return null;
}

describe("useAppShellLifecycle", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let controls: ReturnType<typeof useAppShellLifecycle>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    pendingActionControls.pendingAction = null;
    pendingActionControls.queuePendingAction.mockReset();
    pendingActionControls.resolvePendingActionWithDiscard.mockReset();
    pendingActionControls.resolvePendingActionWithSave.mockReset();

    nativeWindowControls.ensureWindowVisible.mockReset();
    nativeWindowControls.ensureWindowVisible.mockResolvedValue(undefined);
    nativeWindowControls.handleEditorFocusChange.mockReset();
    nativeWindowControls.closeWindow.mockReset();
    nativeWindowControls.closeWindow.mockResolvedValue(undefined);

    useWindowCloseRequestMock.mockReset();
    useWindowCloseRequestMock.mockReturnValue(vi.fn());

    useNativeWindowStateMock.mockReset();
    useNativeWindowStateMock.mockReturnValue(nativeWindowControls);

    usePendingDocumentActionMock.mockReset();
    usePendingDocumentActionMock.mockReturnValue(pendingActionControls);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("wires the native window state and pending action hooks together", async () => {
    const applyOpenedDocument = vi.fn();
    const createNewDocument = vi.fn();
    const loadRecentDocument = vi.fn().mockResolvedValue(null);
    const openWithPicker = vi.fn().mockResolvedValue(null);
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

    expect(useNativeWindowStateMock).toHaveBeenCalledWith(expect.objectContaining({
      filePath: "/tmp/draft.md",
      isDirty: false,
      windowTitle: "draft.md - saved",
    }));
    expect(usePendingDocumentActionMock).toHaveBeenCalledWith(expect.objectContaining({
      activeFilename: "draft.md",
      saveDocument,
    }));
    expect(usePendingDocumentActionMock).not.toHaveBeenCalledWith(expect.objectContaining({
      applyOpenedDocument,
      createNewDocument,
      loadRecentDocument,
      openWithPicker,
    }));
    expect("requestVisibleAction" in controls).toBe(false);
    expect(controls.resolvePendingActionWithDiscard)
      .toBe(pendingActionControls.resolvePendingActionWithDiscard);
    expect(controls.resolvePendingActionWithSave)
      .toBe(pendingActionControls.resolvePendingActionWithSave);
    expect(controls.handleEditorFocusChange)
      .toBe(nativeWindowControls.handleEditorFocusChange);
    expect(controls.isWindowVisible).toBe(true);
  });

  it("closes the current window session through the native close command", async () => {
    let closeWindowSession:
      | ((() => Promise<void>))
      | undefined;

    useWindowCloseRequestMock.mockImplementation(({ closeWindowSession: nextCloseWindowSession }) => {
      closeWindowSession = nextCloseWindowSession;
      return vi.fn();
    });

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
      }));
    });

    expect(closeWindowSession).toBeTypeOf("function");

    await act(async () => {
      await closeWindowSession?.();
    });

    expect(nativeWindowControls.closeWindow).toHaveBeenCalledTimes(1);
  });

  it("derives welcome-mode filename and window title before wiring lifecycle hooks", async () => {
    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          filePath: null,
          filename: null,
          isWelcomeVisible: true,
        },
      }));
    });

    expect(useNativeWindowStateMock).toHaveBeenCalledWith(expect.objectContaining({
      filePath: null,
      isDirty: false,
      windowTitle: "ClipMark",
    }));
    expect(usePendingDocumentActionMock).toHaveBeenCalledWith(expect.objectContaining({
      activeFilename: "ClipMark",
    }));
    expect(controls.isWindowVisible).toBe(true);
  });
});
