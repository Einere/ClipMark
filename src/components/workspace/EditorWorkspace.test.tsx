import { act, createRef, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    return window.setTimeout(() => callback(performance.now()), 16);
  });
  vi.stubGlobal("cancelAnimationFrame", (handle: number) => {
    window.clearTimeout(handle);
  });
});

afterEach(() => {
  while (cleanupHandlers.length > 0) {
    cleanupHandlers.pop()?.();
  }

  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function setMainWidth(renderer: ReturnType<typeof createTestRenderer>, width: number) {
  const main = renderer.container.querySelector(".editor-workspace__main") as HTMLElement | null;

  Object.defineProperty(main, "clientWidth", {
    configurable: true,
    value: width,
  });

  act(() => {
    window.dispatchEvent(new Event("resize"));
  });

  return main;
}

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

    setMainWidth(renderer, 1400);

    const tocHandle = renderer.container.querySelector(
      "[data-panel-resizer='toc']",
    ) as HTMLElement | null;
    const previewHandle = renderer.container.querySelector(
      "[data-panel-resizer='preview']",
    ) as HTMLElement | null;

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

  it("keeps panels mounted during exit transitions before unmounting them", () => {
    const renderer = createTestRenderer();
    cleanupHandlers.push(() => renderer.cleanup());

    const baseProps = {
      documentKey: 4,
      documentStatus: "saved" as const,
      documentStore: createDocumentStore("# Heading\n\nBody"),
      editorRef: createRef<MarkdownEditorHandle>(),
      filePath: "/Users/einere/notes/research.md",
      initialPreviewPanelWidth: 480,
      initialTocPanelWidth: 260,
      isExternalMediaAutoLoadEnabled: false,
      onEditorFocusChange: () => undefined,
      onPanelWidthsChange: () => undefined,
      onPathCopy: () => undefined,
      onPathCopyError: () => undefined,
    };

    renderer.render(
      <EditorWorkspace
        {...baseProps}
        isPreviewVisible
        isTocVisible
      />,
    );
    setMainWidth(renderer, 1400);

    renderer.render(
      <EditorWorkspace
        {...baseProps}
        isPreviewVisible={false}
        isTocVisible={false}
      />,
    );

    const tocShell = renderer.container.querySelector(
      ".editor-workspace__panel-shell[data-panel-kind='toc']",
    );
    const previewPanel = renderer.container.querySelector(
      ".editor-workspace__panel--preview[data-panel='preview']",
    );

    expect(tocShell?.getAttribute("data-panel-state")).toBe("closing");
    expect(previewPanel?.getAttribute("data-panel-state")).toBe("closing");
    expect(
      renderer.container.querySelector("[data-panel-resizer='toc']")?.getAttribute("data-expanded"),
    ).toBe("false");
    expect(
      renderer.container.querySelector("[data-panel-resizer='preview']")?.getAttribute("data-expanded"),
    ).toBe("false");

    act(() => {
      vi.advanceTimersByTime(220);
    });

    expect(
      renderer.container.querySelector(".editor-workspace__panel-shell[data-panel-kind='toc']"),
    ).toBeNull();
    expect(
      renderer.container.querySelector(".editor-workspace__panel--preview[data-panel='preview']"),
    ).toBeNull();
  });

  it("marks newly opened panels as entering before settling to open", () => {
    const renderer = createTestRenderer();
    cleanupHandlers.push(() => renderer.cleanup());

    const baseProps = {
      documentKey: 5,
      documentStatus: "saved" as const,
      documentStore: createDocumentStore("# Heading\n\nBody"),
      editorRef: createRef<MarkdownEditorHandle>(),
      filePath: "/Users/einere/notes/research.md",
      initialPreviewPanelWidth: 480,
      initialTocPanelWidth: 260,
      isExternalMediaAutoLoadEnabled: false,
      onEditorFocusChange: () => undefined,
      onPanelWidthsChange: () => undefined,
      onPathCopy: () => undefined,
      onPathCopyError: () => undefined,
    };

    renderer.render(
      <EditorWorkspace
        {...baseProps}
        isPreviewVisible={false}
        isTocVisible={false}
      />,
    );

    renderer.render(
      <EditorWorkspace
        {...baseProps}
        isPreviewVisible
        isTocVisible
      />,
    );

    expect(
      renderer.container.querySelector(".editor-workspace__panel-shell")?.getAttribute("data-panel-state"),
    ).toBe("entering");
    expect(
      renderer.container.querySelector(".editor-workspace__panel--preview")?.getAttribute("data-panel-state"),
    ).toBe("entering");
    expect(
      renderer.container.querySelector(".editor-workspace__panel-shell")?.getAttribute("data-expanded"),
    ).toBe("false");
    expect(
      renderer.container.querySelector(".editor-workspace__panel--preview")?.getAttribute("data-expanded"),
    ).toBe("false");

    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(
      renderer.container.querySelector(".editor-workspace__panel-shell")?.getAttribute("data-panel-state"),
    ).toBe("open");
    expect(
      renderer.container.querySelector(".editor-workspace__panel--preview")?.getAttribute("data-panel-state"),
    ).toBe("open");
    expect(
      renderer.container.querySelector(".editor-workspace__panel-shell")?.getAttribute("data-expanded"),
    ).toBe("true");
    expect(
      renderer.container.querySelector(".editor-workspace__panel--preview")?.getAttribute("data-expanded"),
    ).toBe("true");
  });

});
