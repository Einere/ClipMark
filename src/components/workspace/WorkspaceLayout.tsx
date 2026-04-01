import type {
  KeyboardEventHandler,
  PointerEventHandler,
  ReactElement,
  ReactNode,
  RefObject,
} from "react";
import { Children, isValidElement } from "react";

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

type WorkspaceLayoutRootProps = {
  children: ReactNode;
  hasRenderedPreview: boolean;
  hasRenderedToc: boolean;
  isResizingPanels: boolean;
  mainRef: RefObject<HTMLElement | null>;
};

type WorkspaceLayoutEditorProps = {
  children: ReactNode;
};

type WorkspaceLayoutSidePanelProps = {
  children: ReactNode;
  isExpanded: boolean;
  isVisible: boolean;
  onResizeKeyDown: KeyboardEventHandler<HTMLDivElement>;
  onResizePointerDown: PointerEventHandler<HTMLDivElement>;
  panelState: string;
  resizeHandleProps: ResizeHandleProps;
  width: number | null;
};

type WorkspaceLayoutComponent = ((props: WorkspaceLayoutRootProps) => ReactElement) & {
  Editor: (props: WorkspaceLayoutEditorProps) => ReactElement;
  Preview: (props: WorkspaceLayoutSidePanelProps) => ReactElement | null;
  Toc: (props: WorkspaceLayoutSidePanelProps) => ReactElement | null;
};

function WorkspaceLayoutEditor({ children }: WorkspaceLayoutEditorProps) {
  return <>{children}</>;
}

function WorkspaceLayoutToc({
  children,
  isExpanded,
  isVisible,
  onResizeKeyDown,
  onResizePointerDown,
  panelState,
  resizeHandleProps,
  width,
}: WorkspaceLayoutSidePanelProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <>
      <div
        className="editor-workspace__panel-shell"
        data-expanded={isExpanded}
        data-panel-kind="toc"
        data-panel-state={panelState}
        style={{
          width: `${width ?? 0}px`,
        }}
      >
        {children}
      </div>
      <div
        {...resizeHandleProps}
        className="editor-workspace__resize-handle"
        onKeyDown={onResizeKeyDown}
        onPointerDown={onResizePointerDown}
      />
    </>
  );
}

function WorkspaceLayoutPreview({
  children,
  isExpanded,
  isVisible,
  onResizeKeyDown,
  onResizePointerDown,
  panelState,
  resizeHandleProps,
  width,
}: WorkspaceLayoutSidePanelProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <>
      <div
        {...resizeHandleProps}
        className="editor-workspace__resize-handle"
        onKeyDown={onResizeKeyDown}
        onPointerDown={onResizePointerDown}
      />
      <section
        className="editor-workspace__panel editor-workspace__panel--preview"
        data-expanded={isExpanded}
        data-panel="preview"
        data-panel-state={panelState}
        style={{
          width: `${width ?? 0}px`,
        }}
      >
        {children}
      </section>
    </>
  );
}

function WorkspaceLayoutRoot({
  children,
  hasRenderedPreview,
  hasRenderedToc,
  isResizingPanels,
  mainRef,
}: WorkspaceLayoutRootProps) {
  let tocChild: ReactNode = null;
  let editorChild: ReactNode = null;
  let previewChild: ReactNode = null;

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      return;
    }

    if (child.type === WorkspaceLayoutToc) {
      tocChild = child;
      return;
    }

    if (child.type === WorkspaceLayoutEditor) {
      editorChild = child;
      return;
    }

    if (child.type === WorkspaceLayoutPreview) {
      previewChild = child;
    }
  });

  return (
    <main
      className="editor-workspace__main"
      data-has-preview={hasRenderedPreview}
      data-has-toc={hasRenderedToc}
      data-resizing={isResizingPanels}
      ref={mainRef}
    >
      {tocChild}
      {editorChild}
      {previewChild}
    </main>
  );
}

export const WorkspaceLayout = Object.assign(WorkspaceLayoutRoot, {
  Editor: WorkspaceLayoutEditor,
  Preview: WorkspaceLayoutPreview,
  Toc: WorkspaceLayoutToc,
}) as WorkspaceLayoutComponent;
