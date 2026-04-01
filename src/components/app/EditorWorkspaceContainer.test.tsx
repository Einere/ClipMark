import { act, createRef } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MarkdownEditorHandle } from "../editor/MarkdownEditor";
import { EditorWorkspaceContainer } from "./EditorWorkspaceContainer";

const showToast = vi.fn();

vi.mock("../workspace/EditorWorkspace", () => ({
  EditorWorkspace: ({
    onPanelWidthsChange,
    onPathCopy,
    onPathCopyError,
  }: {
    onPanelWidthsChange: (widths: {
      previewPanelWidth: number | null;
      tocPanelWidth: number | null;
    }) => void;
    onPathCopy: () => void;
    onPathCopyError: () => void;
  }) => (
    <div>
      <button
        onClick={() => onPanelWidthsChange({
          previewPanelWidth: 420,
          tocPanelWidth: 260,
        })}
        type="button"
      >
        Resize panels
      </button>
      <button onClick={onPathCopy} type="button">
        Copy path
      </button>
      <button onClick={onPathCopyError} type="button">
        Copy path error
      </button>
    </div>
  ),
}));

vi.mock("../toast/ToastProvider", () => ({
  useToast: () => ({
    showToast,
  }),
}));

describe("EditorWorkspaceContainer", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    showToast.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("stores panel widths through the preference setters", async () => {
    const setPreviewPanelWidth = vi.fn();
    const setTocPanelWidth = vi.fn();

    await act(async () => {
      root.render(createElement(EditorWorkspaceContainer, {
        documentKey: 1,
        documentStatus: "saved",
        documentStore: {} as never,
        editorRef: createRef<MarkdownEditorHandle>(),
        filePath: "/tmp/draft.md",
        initialPreviewPanelWidth: null,
        initialTocPanelWidth: null,
        isExternalMediaAutoLoadEnabled: false,
        isPreviewVisible: true,
        isTocVisible: true,
        onEditorFocusChange: vi.fn(),
        setPreviewPanelWidth,
        setTocPanelWidth,
      }));
    });

    await act(async () => {
      (Array.from(container.querySelectorAll("button"))[0] as HTMLButtonElement).click();
    });

    expect(setPreviewPanelWidth).toHaveBeenCalledWith(420);
    expect(setTocPanelWidth).toHaveBeenCalledWith(260);
  });

  it("shows success and error toasts for path copy outcomes", async () => {
    await act(async () => {
      root.render(createElement(EditorWorkspaceContainer, {
        documentKey: 1,
        documentStatus: "saved",
        documentStore: {} as never,
        editorRef: createRef<MarkdownEditorHandle>(),
        filePath: "/tmp/draft.md",
        initialPreviewPanelWidth: null,
        initialTocPanelWidth: null,
        isExternalMediaAutoLoadEnabled: false,
        isPreviewVisible: true,
        isTocVisible: true,
        onEditorFocusChange: vi.fn(),
        setPreviewPanelWidth: vi.fn(),
        setTocPanelWidth: vi.fn(),
      }));
    });

    const buttons = Array.from(container.querySelectorAll("button")) as HTMLButtonElement[];

    await act(async () => {
      buttons[1].click();
      buttons[2].click();
    });

    expect(showToast).toHaveBeenNthCalledWith(
      1,
      "Copied the file path to the clipboard.",
      "success",
    );
    expect(showToast).toHaveBeenNthCalledWith(
      2,
      "Could not copy the file path.",
      "error",
    );
  });
});
