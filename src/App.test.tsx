import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { ToastProvider } from "./components/toast/ToastProvider";
import type { AppPreferences } from "./lib/preview-preferences";
import { DEFAULT_APP_PREFERENCES } from "./lib/preview-preferences";

const capturedProps = vi.hoisted(() => ({
  lastEditor: null as null | {
    setPreviewPanelWidth: (width: number | null) => void;
    setTocPanelWidth: (width: number | null) => void;
  },
}));

vi.mock("./components/app/AppContent", () => ({
  AppContent: ({
    editor,
  }: {
    editor: {
      setPreviewPanelWidth: (width: number | null) => void;
      setTocPanelWidth: (width: number | null) => void;
    };
  }) => {
    capturedProps.lastEditor = editor;

    return (
    <>
      <button
        onClick={() => {
          editor.setPreviewPanelWidth(420);
          editor.setTocPanelWidth(260);
        }}
        type="button"
      >
        Resize panels
      </button>
    </>
    );
  },
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

const setPreviewPanelWidth = vi.fn();
const setTocPanelWidth = vi.fn();

vi.mock("./hooks/useAppPreferences", async () => {
  const actual = await vi.importActual<typeof import("./hooks/useAppPreferences")>("./hooks/useAppPreferences");

  return {
    ...actual,
    useAppPreferences: ({
      initialPreferences,
    }: {
      initialPreferences: AppPreferences;
      onSaveError: () => void;
    }) => ({
      autoLoadExternalMedia: initialPreferences.autoLoadExternalMedia,
      isPreviewVisible: initialPreferences.isPreviewVisible,
      isTocVisible: initialPreferences.isTocVisible,
      previewPanelWidth: initialPreferences.previewPanelWidth,
      setIsExternalMediaAutoLoadEnabled: vi.fn(),
      setIsPreviewVisible: vi.fn(),
      setIsTocVisible: vi.fn(),
      setPreviewPanelWidth,
      setThemeMode: vi.fn(),
      setTocPanelWidth,
      themeMode: initialPreferences.themeMode,
      tocPanelWidth: initialPreferences.tocPanelWidth,
    }),
  };
});

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
  capturedProps.lastEditor = null;
  setPreviewPanelWidth.mockReset();
  setTocPanelWidth.mockReset();
});

afterEach(() => {
  while (cleanupHandlers.length > 0) {
    cleanupHandlers.pop()?.();
  }
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe("App editor screen wiring", () => {
  it("passes the preference setters through to the editor screen container", async () => {
    const renderer = createTestRenderer();
    cleanupHandlers.push(() => renderer.cleanup());

    await act(async () => {
      renderer.render(
        <ToastProvider>
          <App initialPreferences={DEFAULT_APP_PREFERENCES} />
        </ToastProvider>,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    const triggerButton = renderer.container.querySelector("button");
    expect(triggerButton?.textContent).toContain("Resize panels");
    expect(capturedProps.lastEditor).not.toBeNull();

    act(() => {
      (triggerButton as HTMLButtonElement).click();
    });

    expect(setPreviewPanelWidth).toHaveBeenCalledWith(420);
    expect(setTocPanelWidth).toHaveBeenCalledWith(260);
  });
});
