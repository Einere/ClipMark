import type {
  KeyboardEventHandler,
  PointerEventHandler,
  ReactNode,
  RefObject,
} from "react";

export type ResizeHandleProps = {
  "aria-controls": string;
  "aria-label": string;
  "aria-orientation": "vertical";
  "aria-valuemax": number;
  "aria-valuemin": number;
  "aria-valuenow": number | undefined;
  "data-active": boolean;
  "data-expanded": boolean;
  "data-panel-resizer": "preview" | "toc";
  role: "separator";
  tabIndex: number;
};

export type WorkspaceLayoutSidePanel = {
  content: ReactNode;
  isExpanded: boolean;
  onResizeKeyDown: KeyboardEventHandler<HTMLDivElement>;
  onResizePointerDown: PointerEventHandler<HTMLDivElement>;
  panelState: string;
  resizeHandleProps: ResizeHandleProps;
  width: number | null;
};

type WorkspaceLayoutProps = {
  editorContent: ReactNode;
  hasRenderedPreview: boolean;
  hasRenderedToc: boolean;
  isResizingPanels: boolean;
  mainRef: RefObject<HTMLElement | null>;
  preview: WorkspaceLayoutSidePanel | null;
  toc: WorkspaceLayoutSidePanel | null;
};

function WorkspaceResizeHandle({
  onResizeKeyDown,
  onResizePointerDown,
  resizeHandleProps,
}: Pick<
  WorkspaceLayoutSidePanel,
  "onResizeKeyDown" | "onResizePointerDown" | "resizeHandleProps"
>) {
  return (
    <div
      {...resizeHandleProps}
      className="editor-workspace__resize-handle"
      onKeyDown={onResizeKeyDown}
      onPointerDown={onResizePointerDown}
    />
  );
}

function WorkspaceTocPanel({
  content,
  isExpanded,
  panelState,
  width,
}: Pick<WorkspaceLayoutSidePanel, "content" | "isExpanded" | "panelState" | "width">) {
  return (
    <div
      className="editor-workspace__panel-shell"
      data-expanded={isExpanded}
      data-panel-kind="toc"
      data-panel-state={panelState}
      style={{
        width: `${width ?? 0}px`,
      }}
    >
      {content}
    </div>
  );
}

function WorkspacePreviewPanel({
  content,
  isExpanded,
  panelState,
  width,
}: Pick<WorkspaceLayoutSidePanel, "content" | "isExpanded" | "panelState" | "width">) {
  return (
    <section
      className="editor-workspace__panel editor-workspace__panel--preview"
      data-expanded={isExpanded}
      data-panel="preview"
      data-panel-state={panelState}
      style={{
        width: `${width ?? 0}px`,
      }}
    >
      {content}
    </section>
  );
}

export function WorkspaceLayout({
  editorContent,
  hasRenderedPreview,
  hasRenderedToc,
  isResizingPanels,
  mainRef,
  preview,
  toc,
}: WorkspaceLayoutProps) {
  return (
    <main
      className="editor-workspace__main"
      data-has-preview={hasRenderedPreview}
      data-has-toc={hasRenderedToc}
      data-resizing={isResizingPanels}
      ref={mainRef}
    >
      {toc ? (
        <>
          <WorkspaceTocPanel
            content={toc.content}
            isExpanded={toc.isExpanded}
            panelState={toc.panelState}
            width={toc.width}
          />
          <WorkspaceResizeHandle
            onResizeKeyDown={toc.onResizeKeyDown}
            onResizePointerDown={toc.onResizePointerDown}
            resizeHandleProps={toc.resizeHandleProps}
          />
        </>
      ) : null}

      {editorContent}

      {preview ? (
        <>
          <WorkspaceResizeHandle
            onResizeKeyDown={preview.onResizeKeyDown}
            onResizePointerDown={preview.onResizePointerDown}
            resizeHandleProps={preview.resizeHandleProps}
          />
          <WorkspacePreviewPanel
            content={preview.content}
            isExpanded={preview.isExpanded}
            panelState={preview.panelState}
            width={preview.width}
          />
        </>
      ) : null}
    </main>
  );
}
