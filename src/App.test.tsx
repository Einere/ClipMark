import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { DEFAULT_APP_PREFERENCES } from "./lib/preview-preferences";

vi.mock("./components/dialog/UnsavedChangesDialog", () => ({
  UnsavedChangesDialog: () => null,
}));

vi.mock("./components/welcome/WelcomeScreen", () => ({
  WelcomeScreen: () => null,
}));

vi.mock("./hooks/useAppMenuController", () => ({
  useAppMenuController: () => undefined,
}));

vi.mock("./hooks/useDocumentSession", () => ({
  useDocumentSession: () => ({
    applyOpenedDocument: () => undefined,
    clearRecentFilesList: () => undefined,
    closeCurrentDocument: () => undefined,
    createNewDocument: () => undefined,
    documentStore: {},
    editorDocumentKey: 0,
    fileInputRef: { current: null },
    filePath: null,
    filename: null,
    handleOpenFile: () => undefined,
    isWelcomeVisible: false,
    loadRecentDocument: async () => null,
    openWithPicker: async () => null,
    openWithPickerWithoutShowingWindow: async () => null,
    recentFiles: [],
    savedRevision: 0,
    saveDocument: async () => false,
  }),
}));

vi.mock("./components/workspace/EditorWorkspace", () => ({
  EditorWorkspace: ({ onPathCopy }: { onPathCopy: () => void }) => (
    <button onClick={onPathCopy} type="button">
      Trigger toast
    </button>
  ),
}));

vi.mock("./hooks/useNativeWindowState", () => ({
  useNativeWindowState: () => ({
    ensureWindowVisible: async () => undefined,
    handleEditorFocusChange: () => undefined,
    hideWindow: async () => undefined,
  }),
}));

vi.mock("./lib/document-store", () => ({
  useDocumentDirty: () => false,
}));

vi.mock("./lib/debug-log", () => ({
  clearDebugLog: async () => undefined,
}));

vi.mock("./lib/native-close-sheet", () => ({
  showNativeCloseSheet: async () => "cancel",
}));

vi.mock("./lib/native-open-document", () => ({
  setupNativeOpenDocumentListener: async () => () => undefined,
}));

vi.mock("./lib/theme", () => ({
  applyTheme: () => undefined,
  subscribeToSystemTheme: () => () => undefined,
}));

function createTestRenderer() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  return {
    container,
    cleanup() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
    render(element: ReactNode) {
      act(() => {
        root.render(element);
      });
    },
  };
}

const cleanupHandlers: Array<() => void> = [];

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  while (cleanupHandlers.length > 0) {
    cleanupHandlers.pop()?.();
  }
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe("App toast lifecycle", () => {
  it("automatically transitions the toast to exit and then removes it", async () => {
    const renderer = createTestRenderer();
    cleanupHandlers.push(() => renderer.cleanup());

    await act(async () => {
      renderer.render(<App initialPreferences={DEFAULT_APP_PREFERENCES} />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const triggerButton = renderer.container.querySelector("button");
    expect(triggerButton?.textContent).toContain("Trigger toast");

    act(() => {
      (triggerButton as HTMLButtonElement).click();
    });

    let toast = renderer.container.querySelector("[role='status']");
    expect(toast?.getAttribute("data-phase")).toBe("enter");

    act(() => {
      vi.advanceTimersByTime(3200);
    });

    toast = renderer.container.querySelector("[role='status']");
    expect(toast?.getAttribute("data-phase")).toBe("exit");

    toast = renderer.container.querySelector("[role='status']");
    expect(toast?.getAttribute("data-phase")).toBe("exit");

    act(() => {
      const animationEndEvent = new Event("animationend", { bubbles: true });
      Object.defineProperty(animationEndEvent, "animationName", {
        value: "ui-toast-exit",
      });
      toast?.dispatchEvent(animationEndEvent);
    });

    toast = renderer.container.querySelector("[role='status']");
    expect(toast).toBeNull();
  });
});
