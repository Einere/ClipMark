import { act, createRef, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDocumentStore } from "../../lib/document-store";
import type { MarkdownEditorHandle } from "../editor/MarkdownEditor";
import { EditorWorkspace } from "./EditorWorkspace";

vi.mock("../editor/MarkdownEditor", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");

  return {
    MarkdownEditor: forwardRef<MarkdownEditorHandle, object>(function MockMarkdownEditor(
      _props,
      ref,
    ) {
      useImperativeHandle(ref, () => ({
        focus() {
          return undefined;
        },
        hasFocus() {
          return false;
        },
        focusHeadingLine() {
          return undefined;
        },
      }));

      return <div data-testid="markdown-editor">editor</div>;
    }),
  };
});

vi.mock("../preview/MarkdownPreview", () => ({
  MarkdownPreview: ({ markdown }: { markdown: string }) => (
    <div data-testid="markdown-preview">{markdown}</div>
  ),
}));

vi.mock("../toc/TocPanel", () => ({
  TocPanel: ({ headings }: { headings: Array<{ text: string }> }) => (
    <aside data-testid="toc-panel">{headings.map((heading) => heading.text).join(", ")}</aside>
  ),
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

afterEach(() => {
  while (cleanupHandlers.length > 0) {
    cleanupHandlers.pop()?.();
  }
});

describe("EditorWorkspace", () => {
  it("keeps document metadata in the footer while rendering minimal panel headers", () => {
    const renderer = createTestRenderer();
    cleanupHandlers.push(() => renderer.cleanup());

    renderer.render(
      <EditorWorkspace
        documentKey={1}
        documentStatus="edited"
        documentStore={createDocumentStore("# Heading\n\nBody")}
        editorRef={createRef<MarkdownEditorHandle>()}
        filePath="/Users/einere/notes/research.md"
        initialPreviewPanelWidth={480}
        initialTocPanelWidth={260}
        isExternalMediaAutoLoadEnabled={false}
        isPreviewVisible
        isTocVisible
        onEditorFocusChange={() => undefined}
        onPanelWidthsChange={() => undefined}
        onPathCopy={() => undefined}
        onPathCopyError={() => undefined}
      />,
    );

    const footerPath = renderer.container.querySelector(".editor-workspace__path-button");
    const editorPanel = renderer.container.querySelector(".editor-workspace__panel[data-panel='editor']");
    const headings = Array.from(
      renderer.container.querySelectorAll(".editor-workspace__panel-kicker, .toc-panel__kicker"),
    ).map((element) => element.textContent);

    expect(headings).toEqual(["Writing", "Reading"]);
    expect(editorPanel?.hasAttribute("data-focused")).toBe(false);
    expect(renderer.container.textContent).not.toContain("Rendered preview");
    expect(footerPath?.textContent).toContain("/Users/einere/notes/research.md");
    expect(renderer.container.textContent).toContain("Unsaved");
    expect(renderer.container.textContent).toContain("1 headings");
  });

  it("shows draft context and the preview empty state for blank documents", () => {
    const renderer = createTestRenderer();
    cleanupHandlers.push(() => renderer.cleanup());

    renderer.render(
      <EditorWorkspace
        documentKey={2}
        documentStatus={null}
        documentStore={createDocumentStore("")}
        editorRef={createRef<MarkdownEditorHandle>()}
        filePath={null}
        initialPreviewPanelWidth={null}
        initialTocPanelWidth={null}
        isExternalMediaAutoLoadEnabled={false}
        isPreviewVisible
        isTocVisible={false}
        onEditorFocusChange={() => undefined}
        onPanelWidthsChange={() => undefined}
        onPathCopy={() => undefined}
        onPathCopyError={() => undefined}
      />,
    );

    expect(renderer.container.textContent).toContain("Unsaved local document");
    expect(renderer.container.textContent).toContain("Draft");
    expect(renderer.container.textContent).toContain(
      "Start writing in the editor to build a clean reading view here.",
    );
  });

  it("renders resize handles and commits keyboard resizing", () => {
    const renderer = createTestRenderer();
    cleanupHandlers.push(() => renderer.cleanup());
    const onPanelWidthsChange = vi.fn();

    renderer.render(
      <EditorWorkspace
        documentKey={3}
        documentStatus="saved"
        documentStore={createDocumentStore("# Heading\n\nBody")}
        editorRef={createRef<MarkdownEditorHandle>()}
        filePath="/Users/einere/notes/research.md"
        initialPreviewPanelWidth={480}
        initialTocPanelWidth={260}
        isExternalMediaAutoLoadEnabled={false}
        isPreviewVisible
        isTocVisible
        onEditorFocusChange={() => undefined}
        onPanelWidthsChange={onPanelWidthsChange}
        onPathCopy={() => undefined}
        onPathCopyError={() => undefined}
      />,
    );

    const main = renderer.container.querySelector(".editor-workspace__main") as HTMLElement | null;
    const tocHandle = renderer.container.querySelector(
      "[data-panel-resizer='toc']",
    ) as HTMLElement | null;
    const previewHandle = renderer.container.querySelector(
      "[data-panel-resizer='preview']",
    ) as HTMLElement | null;

    Object.defineProperty(main, "clientWidth", {
      configurable: true,
      value: 1400,
    });

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(tocHandle).toBeTruthy();
    expect(previewHandle).toBeTruthy();

    act(() => {
      tocHandle?.dispatchEvent(new KeyboardEvent("keydown", {
        bubbles: true,
        key: "ArrowRight",
      }));
    });

    expect(onPanelWidthsChange).toHaveBeenCalledWith({
      previewPanelWidth: 480,
      tocPanelWidth: 276,
    });
  });
});
