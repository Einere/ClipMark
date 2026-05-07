import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppShellLifecycle } from "./useAppShellLifecycle";

const pendingActionControls = vi.hoisted(() => ({
  pendingAction: null,
  queuePendingAction: vi.fn(),
  requestAction: vi.fn(),
  requestVisibleAction: vi.fn(),
  resolvePendingActionWithDiscard: vi.fn(),
  resolvePendingActionWithSave: vi.fn(),
}));

const nativeWindowControls = vi.hoisted(() => ({
  ensureWindowVisible: vi.fn().mockResolvedValue(undefined),
  handleEditorFocusChange: vi.fn(),
  hideWindow: vi.fn().mockResolvedValue(undefined),
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
    applyOpenedDocument: vi.fn(),
    closeCurrentDocument: vi.fn(),
    createNewDocument: vi.fn(),
    filePath: "/tmp/draft.md",
    filename: "draft.md",
    isDirty: false,
    isWelcomeVisible: false,
    loadRecentDocument: vi.fn().mockResolvedValue(null),
    openWithPicker: vi.fn().mockResolvedValue(null),
    openWithPickerWithoutShowingWindow: vi.fn().mockResolvedValue(null),
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
    pendingActionControls.requestAction.mockReset();
    pendingActionControls.requestVisibleAction.mockReset();
    pendingActionControls.resolvePendingActionWithDiscard.mockReset();
    pendingActionControls.resolvePendingActionWithSave.mockReset();

    nativeWindowControls.ensureWindowVisible.mockReset();
    nativeWindowControls.ensureWindowVisible.mockResolvedValue(undefined);
    nativeWindowControls.handleEditorFocusChange.mockReset();
    nativeWindowControls.hideWindow.mockReset();
    nativeWindowControls.hideWindow.mockResolvedValue(undefined);

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
    const openWithPickerWithoutShowingWindow = vi.fn().mockResolvedValue(null);
    const saveDocument = vi.fn().mockResolvedValue(true);

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          applyOpenedDocument,
          createNewDocument,
          loadRecentDocument,
          openWithPicker,
          openWithPickerWithoutShowingWindow,
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
      applyOpenedDocument,
      createNewDocument,
      ensureWindowVisible: nativeWindowControls.ensureWindowVisible,
      loadRecentDocument,
      openWithPicker,
      openWithPickerWithoutShowingWindow,
      saveDocument,
    }));
    expect(controls.requestAction).toBe(pendingActionControls.requestAction);
    expect(controls.requestVisibleAction).toBe(pendingActionControls.requestVisibleAction);
    expect(controls.resolvePendingActionWithDiscard)
      .toBe(pendingActionControls.resolvePendingActionWithDiscard);
    expect(controls.resolvePendingActionWithSave)
      .toBe(pendingActionControls.resolvePendingActionWithSave);
    expect(controls.handleEditorFocusChange)
      .toBe(nativeWindowControls.handleEditorFocusChange);
    expect(controls.isWindowVisible).toBe(true);
  });

  it("closes the current window session by hiding first and then resetting the document", async () => {
    const closeCurrentDocument = vi.fn();
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
        overrides: {
          closeCurrentDocument,
        },
      }));
    });

    expect(closeWindowSession).toBeTypeOf("function");

    await act(async () => {
      await closeWindowSession?.();
    });

    expect(nativeWindowControls.hideWindow).toHaveBeenCalledTimes(1);
    expect(closeCurrentDocument).toHaveBeenCalledTimes(1);
    expect(nativeWindowControls.hideWindow.mock.invocationCallOrder[0])
      .toBeLessThan(closeCurrentDocument.mock.invocationCallOrder[0]);
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
