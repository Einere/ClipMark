import type { ReactNode } from "react";
import { createRef } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceLayout } from "./WorkspaceLayout";

function createTestRenderer() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  return {
    cleanup() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
    container,
    render(element: ReactNode) {
      act(() => {
        root.render(element);
      });
    },
  };
}

function createResizeHandleProps(kind: "preview" | "toc") {
  return {
    "aria-controls": "editor-workspace-editor-panel",
    "aria-label": kind === "toc" ? "Resize table of contents panel" : "Resize preview panel",
    "aria-orientation": "vertical" as const,
    "aria-valuemax": 400,
    "aria-valuemin": 100,
    "aria-valuenow": 200,
    "data-active": false,
    "data-expanded": true,
    "data-panel-resizer": kind,
    role: "separator" as const,
    tabIndex: 0,
  };
}

function createSidePanelModel(kind: "preview" | "toc", content: ReactNode) {
  return {
    content,
    isExpanded: true,
    onResizeKeyDown: vi.fn(),
    onResizePointerDown: vi.fn(),
    panelState: "open",
    resizeHandleProps: createResizeHandleProps(kind),
    width: 200,
  };
}

describe("WorkspaceLayout", () => {
  let renderer: ReturnType<typeof createTestRenderer>;

  beforeEach(() => {
    renderer = createTestRenderer();
  });

  afterEach(() => {
    renderer.cleanup();
  });

  it("renders editor, toc, and preview panels from panel models", () => {
    renderer.render(
      <WorkspaceLayout
        editorContent={<section data-panel="editor" id="editor-workspace-editor-panel">editor</section>}
        hasRenderedPreview
        hasRenderedToc
        isResizingPanels={false}
        mainRef={createRef<HTMLElement>()}
        preview={createSidePanelModel("preview", <div data-testid="preview-content">preview</div>)}
        toc={createSidePanelModel("toc", <div data-testid="toc-content">toc</div>)}
      />,
    );

    expect(renderer.container.querySelector("[data-panel='editor']")?.textContent).toBe("editor");
    expect(renderer.container.querySelector("[data-panel-kind='toc']")?.textContent).toContain("toc");
    expect(renderer.container.querySelector("[data-panel='preview']")?.textContent).toContain("preview");
    expect(renderer.container.querySelectorAll("[role='separator']")).toHaveLength(2);
    expect(renderer.container.querySelector(".editor-workspace__main")?.getAttribute("data-resizing")).toBe("false");
  });

  it("omits side panels that are not currently rendered", () => {
    renderer.render(
      <WorkspaceLayout
        editorContent={<section data-panel="editor" id="editor-workspace-editor-panel">editor</section>}
        hasRenderedPreview={false}
        hasRenderedToc={false}
        isResizingPanels={false}
        mainRef={createRef<HTMLElement>()}
        preview={null}
        toc={null}
      />,
    );

    expect(renderer.container.querySelector("[data-panel-kind='toc']")).toBeNull();
    expect(renderer.container.querySelector("[data-panel='preview']")).toBeNull();
    expect(renderer.container.querySelectorAll("[role='separator']")).toHaveLength(0);
    expect(renderer.container.querySelector("[data-panel='editor']")?.textContent).toBe("editor");
  });
});
