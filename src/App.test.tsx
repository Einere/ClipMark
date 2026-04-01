import { act, type ReactNode, type RefObject } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { ToastProvider } from "./components/toast/ToastProvider";
import type { AppPreferences } from "./lib/preview-preferences";
import { DEFAULT_APP_PREFERENCES } from "./lib/preview-preferences";

type WelcomeScreenProps = {
  onNew: () => void;
  onOpen: () => void;
  onOpenRecent: (path: string) => void;
  recentFiles: Array<{ path: string }>;
};

type EditorWorkspaceProps = {
  documentKey: number;
  documentStatus: unknown;
  documentStore: unknown;
  editorRef: RefObject<unknown>;
  filePath: string | null;
  initialPreviewPanelWidth: number | null;
  initialTocPanelWidth: number | null;
  isExternalMediaAutoLoadEnabled: boolean;
  isPreviewVisible: boolean;
  isTocVisible: boolean;
  onEditorFocusChange: (focused: boolean) => void;
  onPanelWidthsChange: (widths: {
    previewPanelWidth: number | null;
    tocPanelWidth: number | null;
  }) => void;
};

type UnsavedChangesDialogProps = {
  confirmLabel: string;
  description: string;
  filename: string;
  onDiscard: () => void;
  onSave: () => void;
  open: boolean;
  title: string;
};

const shellState = vi.hoisted(() => {
  const fileInputRef = { current: null as HTMLInputElement | null };
  const handleOpenFile = vi.fn();
  const setPreviewPanelWidth = vi.fn();
  const setTocPanelWidth = vi.fn();
  const setIsExternalMediaAutoLoadEnabled = vi.fn();
  const setIsPreviewVisible = vi.fn();
  const setIsTocVisible = vi.fn();
  const setThemeMode = vi.fn();

  return {
    actions: {
      handleMenuCopyFilePath: vi.fn(),
      handleMenuNew: vi.fn(),
      handleMenuOpen: vi.fn(),
      handleMenuOpenRecent: vi.fn(),
      handleMenuSave: vi.fn(),
      handleMenuSetThemeMode: vi.fn(),
      handleMenuToggleExternalMedia: vi.fn(),
      handleMenuTogglePreview: vi.fn(),
      handleMenuToggleToc: vi.fn(),
      handleWelcomeNew: vi.fn(),
      handleWelcomeOpen: vi.fn(),
      handleWelcomeOpenRecent: vi.fn(),
    },
    lifecycle: {
      handleEditorFocusChange: vi.fn(),
      isWindowVisible: true,
      pendingAction: null as null | { type: string },
      requestAction: vi.fn(),
      requestVisibleAction: vi.fn(),
      resolvePendingActionWithDiscard: vi.fn(),
      resolvePendingActionWithSave: vi.fn(),
    },
    menuBindings: {
      menuHandlers: {},
      menuState: {},
    },
    preferences: {
      setIsExternalMediaAutoLoadEnabled,
      setIsPreviewVisible,
      setIsTocVisible,
      setPreviewPanelWidth,
      setThemeMode,
      setTocPanelWidth,
    },
    editorWorkspaceLoad: Promise.resolve(),
    fallbackRendered: false,
    rendered: {
      dialog: null as UnsavedChangesDialogProps | null,
      editor: null as EditorWorkspaceProps | null,
      welcome: null as WelcomeScreenProps | null,
    },
    session: {
      applyOpenedDocument: vi.fn(),
      clearRecentFilesList: vi.fn(),
      closeCurrentDocument: vi.fn(),
      createNewDocument: vi.fn(),
      documentStore: {} as never,
      editorDocumentKey: 1,
      fileInputRef,
      filePath: null as string | null,
      filename: null as string | null,
      handleOpenFile,
      isWelcomeVisible: true,
      loadRecentDocument: vi.fn(async () => null),
      openWithPicker: vi.fn(async () => null),
      openWithPickerWithoutShowingWindow: vi.fn(async () => null),
      recentFiles: [],
      savedRevision: 0,
      saveDocument: vi.fn(async () => false),
    },
    viewState: {
      activeFilename: "ClipMark",
      canCopyFilePath: false,
      canSaveDocument: false,
      canTogglePanels: false,
      dialogState: {
        confirmLabel: "Discard",
        description: "has unsaved changes.",
        title: "Unsaved changes",
      },
      documentStatus: null,
      visibleDocumentStatus: null,
    },
  };
});

vi.mock("./components/welcome/WelcomeScreen", () => ({
  WelcomeScreen: (props: WelcomeScreenProps) => {
    shellState.rendered.welcome = props;

    return (
      <button type="button">
        Welcome shell
      </button>
    );
  },
}));

vi.mock("./components/workspace/EditorWorkspace", async () => {
  await shellState.editorWorkspaceLoad;

  return {
    EditorWorkspace: (props: EditorWorkspaceProps) => {
      shellState.rendered.editor = props;

      return (
        <div data-testid="editor-shell">
          Editor shell
        </div>
      );
    },
  };
});

vi.mock("./components/dialog/UnsavedChangesDialog", () => ({
  UnsavedChangesDialog: (props: UnsavedChangesDialogProps) => {
    shellState.rendered.dialog = props;

    return props.open ? <div data-testid="unsaved-dialog">Unsaved dialog</div> : null;
  },
}));

vi.mock("./hooks/useAppMenuController", () => ({
  useAppMenuController: () => undefined,
}));

vi.mock("./hooks/useAppMenuBindings", () => ({
  useAppMenuBindings: () => shellState.menuBindings,
}));

vi.mock("./hooks/useAppPreferences", () => ({
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
    setIsExternalMediaAutoLoadEnabled: shellState.preferences.setIsExternalMediaAutoLoadEnabled,
    setIsPreviewVisible: shellState.preferences.setIsPreviewVisible,
    setIsTocVisible: shellState.preferences.setIsTocVisible,
    setPreviewPanelWidth: shellState.preferences.setPreviewPanelWidth,
    setThemeMode: shellState.preferences.setThemeMode,
    setTocPanelWidth: shellState.preferences.setTocPanelWidth,
    themeMode: initialPreferences.themeMode,
    tocPanelWidth: initialPreferences.tocPanelWidth,
  }),
}));

vi.mock("./hooks/useAppShellActions", () => ({
  useAppShellActions: () => shellState.actions,
}));

vi.mock("./hooks/useAppShellLifecycle", () => ({
  useAppShellLifecycle: () => shellState.lifecycle,
}));

vi.mock("./hooks/useAppViewState", () => ({
  useAppViewState: () => shellState.viewState,
}));

vi.mock("./hooks/useDocumentSession", () => ({
  useDocumentSession: () => shellState.session,
}));

vi.mock("./hooks/useNativeOpenDocumentListener", () => ({
  useNativeOpenDocumentListener: () => undefined,
}));

vi.mock("./hooks/useWindowShortcuts", () => ({
  useWindowShortcuts: () => undefined,
}));

vi.mock("./lib/debug-log", () => ({
  clearDebugLog: async () => undefined,
}));

vi.mock("./lib/document-store", () => ({
  useDocumentDirty: () => false,
}));

const cleanupHandlers: Array<() => void> = [];

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

function renderApp() {
  const renderer = createTestRenderer();
  cleanupHandlers.push(() => renderer.cleanup());

  return renderer;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  shellState.editorWorkspaceLoad = Promise.resolve();
  shellState.fallbackRendered = false;
  shellState.rendered.dialog = null;
  shellState.rendered.editor = null;
  shellState.rendered.welcome = null;
  shellState.viewState.activeFilename = "ClipMark";
  shellState.viewState.dialogState = {
    confirmLabel: "Discard",
    description: "has unsaved changes.",
    title: "Unsaved changes",
  };
  shellState.lifecycle.isWindowVisible = true;
  shellState.lifecycle.pendingAction = null;
  shellState.session.fileInputRef.current = null;
  shellState.session.filePath = null;
  shellState.session.filename = null;
  shellState.session.isWelcomeVisible = true;
  shellState.session.recentFiles = [];
});

afterEach(() => {
  while (cleanupHandlers.length > 0) {
    cleanupHandlers.pop()?.();
  }
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe("App shell", () => {
  it("renders welcome, dialog, and file input wiring through App", async () => {
    const renderer = renderApp();

    shellState.session.isWelcomeVisible = true;
    shellState.lifecycle.pendingAction = null;

    await act(async () => {
      renderer.render(
        <ToastProvider>
          <App initialPreferences={DEFAULT_APP_PREFERENCES} />
        </ToastProvider>,
      );
    });

    expect(shellState.rendered.welcome).not.toBeNull();
    expect(shellState.rendered.welcome?.onNew).toBe(shellState.actions.handleWelcomeNew);
    expect(shellState.rendered.welcome?.onOpen).toBe(shellState.actions.handleWelcomeOpen);
    expect(shellState.rendered.welcome?.onOpenRecent).toBe(shellState.actions.handleWelcomeOpenRecent);
    expect(shellState.rendered.welcome?.recentFiles).toBe(shellState.session.recentFiles);
    expect(shellState.rendered.editor).toBeNull();
    expect(shellState.rendered.dialog).not.toBeNull();
    expect(shellState.rendered.dialog?.open).toBe(false);
    expect(shellState.rendered.dialog?.filename).toBe("ClipMark");
    expect(shellState.rendered.dialog?.confirmLabel).toBe(shellState.viewState.dialogState.confirmLabel);
    expect(shellState.rendered.dialog?.title).toBe(shellState.viewState.dialogState.title);

    const fileInput = renderer.container.querySelector("input[type='file']") as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    expect(fileInput?.hidden).toBe(true);
    expect(fileInput?.accept).toBe(".md,text/markdown,text/plain");
    expect(shellState.session.fileInputRef.current).toBe(fileInput);

    act(() => {
      fileInput?.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(shellState.session.handleOpenFile).toHaveBeenCalledTimes(1);
    expect(renderer.container.querySelector("[data-testid='editor-shell']")).toBeNull();
    expect(renderer.container.querySelector("[data-testid='unsaved-dialog']")).toBeNull();
  });

  it("renders the editor workspace wiring when welcome mode is hidden", async () => {
    const renderer = renderApp();

    shellState.session.isWelcomeVisible = false;
    shellState.session.filePath = "/tmp/draft.md";
    shellState.session.filename = "draft.md";
    shellState.viewState.activeFilename = "draft.md";

    await act(async () => {
      renderer.render(
        <ToastProvider>
          <App initialPreferences={DEFAULT_APP_PREFERENCES} />
        </ToastProvider>,
      );
    });

    expect(shellState.rendered.welcome).toBeNull();
    expect(shellState.rendered.editor).not.toBeNull();
    expect(shellState.rendered.editor?.documentKey).toBe(shellState.session.editorDocumentKey);
    expect(shellState.rendered.editor?.documentStatus).toBe(shellState.viewState.visibleDocumentStatus);
    expect(shellState.rendered.editor?.documentStore).toBe(shellState.session.documentStore);
    expect(shellState.rendered.editor?.filePath).toBe("/tmp/draft.md");
    expect(shellState.rendered.editor?.initialPreviewPanelWidth).toBe(DEFAULT_APP_PREFERENCES.previewPanelWidth);
    expect(shellState.rendered.editor?.initialTocPanelWidth).toBe(DEFAULT_APP_PREFERENCES.tocPanelWidth);
    expect(shellState.rendered.editor?.isExternalMediaAutoLoadEnabled).toBe(DEFAULT_APP_PREFERENCES.autoLoadExternalMedia);
    expect(shellState.rendered.editor?.isPreviewVisible).toBe(DEFAULT_APP_PREFERENCES.isPreviewVisible);
    expect(shellState.rendered.editor?.isTocVisible).toBe(DEFAULT_APP_PREFERENCES.isTocVisible);
    expect(shellState.rendered.editor?.onEditorFocusChange).toBe(shellState.lifecycle.handleEditorFocusChange);
    expect(shellState.rendered.editor?.onPanelWidthsChange).toEqual(expect.any(Function));
    shellState.rendered.editor?.onPanelWidthsChange({
      previewPanelWidth: 320,
      tocPanelWidth: 180,
    });
    expect(shellState.preferences.setPreviewPanelWidth).toHaveBeenCalledWith(320);
    expect(shellState.preferences.setTocPanelWidth).toHaveBeenCalledWith(180);
    expect(renderer.container.querySelector("[data-testid='editor-shell']")).not.toBeNull();
    expect(shellState.rendered.dialog?.open).toBe(false);
    expect(shellState.rendered.dialog?.filename).toBe("draft.md");
  });

  it("opens the unsaved dialog and resolves the pending action through App", async () => {
    const renderer = renderApp();

    shellState.session.isWelcomeVisible = false;
    shellState.lifecycle.pendingAction = { type: "save" };
    shellState.viewState.activeFilename = "draft.md";

    await act(async () => {
      renderer.render(
        <ToastProvider>
          <App initialPreferences={DEFAULT_APP_PREFERENCES} />
        </ToastProvider>,
      );
    });

    expect(shellState.rendered.dialog).not.toBeNull();
    expect(shellState.rendered.dialog?.open).toBe(true);
    expect(shellState.rendered.dialog?.filename).toBe("draft.md");
    expect(shellState.rendered.dialog?.confirmLabel).toBe(shellState.viewState.dialogState.confirmLabel);
    expect(shellState.rendered.dialog?.description).toBe(shellState.viewState.dialogState.description);
    expect(shellState.rendered.dialog?.title).toBe(shellState.viewState.dialogState.title);
    expect(renderer.container.querySelector("[data-testid='unsaved-dialog']")).not.toBeNull();

    shellState.rendered.dialog?.onDiscard();
    shellState.rendered.dialog?.onSave();

    expect(shellState.lifecycle.resolvePendingActionWithDiscard).toHaveBeenCalledTimes(1);
    expect(shellState.lifecycle.resolvePendingActionWithSave).toHaveBeenCalledTimes(1);
  });

  it("shows the Suspense fallback while the lazy editor workspace import is still pending", async () => {
    await vi.resetModules();
    shellState.editorWorkspaceLoad = new Promise(() => undefined);
    shellState.fallbackRendered = false;

    vi.doUnmock("./components/workspace/EditorWorkspace");
    vi.doMock("./components/workspace/EditorWorkspace", async () => {
      await shellState.editorWorkspaceLoad;

      return {
        EditorWorkspace: (props: EditorWorkspaceProps) => {
          shellState.rendered.editor = props;

          return (
            <div data-testid="editor-shell">
              Editor shell
            </div>
          );
        },
      };
    });

    vi.doMock("./components/app/AppShellFallback", () => ({
      AppShellFallback: () => {
        shellState.fallbackRendered = true;

        return (
          <div data-testid="app-shell-fallback">
            Opening editor
          </div>
        );
      },
    }));

    const [{ default: FreshApp }, { ToastProvider: FreshToastProvider }] = await Promise.all([
      import("./App"),
      import("./components/toast/ToastProvider"),
    ]);
    const renderer = createTestRenderer();
    cleanupHandlers.push(() => renderer.cleanup());

    shellState.session.isWelcomeVisible = false;

    await act(async () => {
      renderer.render(
        <FreshToastProvider>
          <FreshApp initialPreferences={DEFAULT_APP_PREFERENCES} />
        </FreshToastProvider>,
      );
      await Promise.resolve();
    });

    expect(shellState.fallbackRendered).toBe(true);
    expect(renderer.container.querySelector("[data-testid='editor-shell']")).toBeNull();
  });
});
