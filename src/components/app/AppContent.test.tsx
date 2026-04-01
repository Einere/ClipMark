import { act } from "react";
import { createElement, createRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppContent } from "./AppContent";
import type { MarkdownEditorHandle } from "../editor/MarkdownEditor";

vi.mock("../welcome/WelcomeScreen", () => ({
  WelcomeScreen: ({ onNew }: { onNew: () => void }) => (
    <button onClick={onNew} type="button">
      Welcome
    </button>
  ),
}));

vi.mock("../workspace/EditorWorkspace", () => ({
  EditorWorkspace: () => (
    <div data-testid="editor-workspace">Editor workspace</div>
  ),
}));

vi.mock("../dialog/UnsavedChangesDialog", () => ({
  UnsavedChangesDialog: ({ open }: { open: boolean }) => (
    open ? <div data-testid="unsaved-dialog">Dialog</div> : null
  ),
}));

function createProps() {
  return {
    dialog: {
      confirmLabel: "Discard",
      description: "has unsaved changes.",
      filename: "draft.md",
      onDiscard: vi.fn(),
      onSave: vi.fn(),
      open: false,
      title: "Unsaved changes",
    },
    editor: {
      documentKey: 1,
      documentStatus: null,
      documentStore: {} as never,
      editorRef: createRef<MarkdownEditorHandle>(),
      filePath: null,
      initialPreviewPanelWidth: null,
      initialTocPanelWidth: null,
      isExternalMediaAutoLoadEnabled: false,
      isPreviewVisible: true,
      isTocVisible: false,
      onEditorFocusChange: vi.fn(),
      onPanelWidthsChange: vi.fn(),
      onPathCopy: vi.fn(),
      onPathCopyError: vi.fn(),
    },
    fileInput: {
      onChange: vi.fn(),
      ref: createRef<HTMLInputElement>(),
    },
    welcome: {
      isVisible: true as boolean,
      onNew: vi.fn(),
      onOpen: vi.fn(),
      onOpenRecent: vi.fn(),
      recentFiles: [],
    },
  };
}

describe("AppContent", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

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

  it("renders the welcome screen when welcome mode is visible", async () => {
    const props = createProps();

    await act(async () => {
      root.render(createElement(AppContent, props));
    });

    expect(container.textContent).toContain("Welcome");
    expect(container.querySelector("[data-testid='editor-workspace']")).toBeNull();
  });

  it("renders the editor workspace when welcome mode is hidden", async () => {
    const props = createProps();
    props.welcome.isVisible = false;

    await act(async () => {
      root.render(createElement(AppContent, props));
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector("[data-testid='editor-workspace']")).not.toBeNull();
  });

  it("renders the dialog when it is open", async () => {
    const props = createProps();
    props.dialog.open = true;

    await act(async () => {
      root.render(createElement(AppContent, props));
    });

    expect(container.querySelector("[data-testid='unsaved-dialog']")).not.toBeNull();
  });
});
