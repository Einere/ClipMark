import type { RefObject } from "react";
import { useDeferredValue, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { MarkdownEditorHandle } from "../editor/MarkdownEditor";
import { MarkdownEditor } from "../editor/MarkdownEditor";
import { MarkdownPreview } from "../preview/MarkdownPreview";
import { TocPanel } from "../toc/TocPanel";
import type { DocumentStore } from "../../lib/document-store";
import { useDocumentMarkdown } from "../../lib/document-store";
import { extractHeadings, getActiveHeadingLine } from "../../lib/toc";
import { summarizeDocument } from "../../lib/document-metrics";
import type { DocumentStatus } from "../../lib/window-state";
import {
  EditorViewStateProvider,
  useActiveEditorLine,
  useEditorViewState,
} from "../../hooks/useEditorViewState";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useIdleValue } from "../../hooks/useIdleValue";
import {
  getPanelResizeHandleProps,
} from "./panel-resize-handle";
import { getPanelDisplayState } from "./panel-display-state";
import { WorkspaceLayout } from "./WorkspaceLayout";
import { usePanelPresence } from "./usePanelPresence";
import { usePanelResizing } from "./usePanelResizing";

const PREVIEW_DEBOUNCE_MS = 120;
const PREVIEW_IDLE_TIMEOUT_MS = 250;

type EditorWorkspaceProps = {
  documentKey: number;
  documentStore: DocumentStore;
  documentStatus: DocumentStatus | null;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  filePath: string | null;
  initialPreviewPanelWidth: number | null;
  initialTocPanelWidth: number | null;
  isExternalMediaAutoLoadEnabled: boolean;
  isPreviewVisible: boolean;
  isTocVisible: boolean;
  onPanelWidthsChange: (widths: {
    previewPanelWidth: number | null;
    tocPanelWidth: number | null;
  }) => void;
  onPathCopy: (path: string) => void;
  onPathCopyError: () => void;
  onEditorFocusChange: (focused: boolean) => void;
};

function formatDocumentStatus(documentStatus: DocumentStatus | null) {
  if (documentStatus === "edited") {
    return "Unsaved";
  }

  if (documentStatus === "saved") {
    return "Saved";
  }

  return "Draft";
}

function getFileLabel(filePath: string | null) {
  if (!filePath) {
    return "Unsaved local document";
  }

  const segments = filePath.split(/[\\/]/);
  return segments.at(-1) ?? filePath;
}

function DocumentPreviewPane({
  markdown,
  filePath,
  isExternalMediaAutoLoadEnabled,
  isLayoutTransitioning,
  layoutVersion,
}: {
  markdown: string;
  filePath: string | null;
  isExternalMediaAutoLoadEnabled: boolean;
  isLayoutTransitioning: boolean;
  layoutVersion: number;
}) {
  const { activeLine, isFocused } = useEditorViewState();
  const debouncedPreviewMarkdown = useDebouncedValue(markdown, PREVIEW_DEBOUNCE_MS);
  const previewMarkdown = useIdleValue(debouncedPreviewMarkdown, {
    timeoutMs: PREVIEW_IDLE_TIMEOUT_MS,
  });
  const isDocumentEmpty = markdown.trim().length === 0;

  if (isDocumentEmpty) {
    return (
      <div className="editor-workspace__preview-empty-state">
        <p className="editor-workspace__preview-empty-kicker">Preview</p>
        <h2 className="editor-workspace__preview-empty-title">
          Start writing in the editor to build a clean reading view here.
        </h2>
      </div>
    );
  }

  return (
    <MarkdownPreview
      activeLine={activeLine}
      filePath={filePath}
      isAutoScrollEnabled={isFocused}
      isExternalMediaAutoLoadEnabled={isExternalMediaAutoLoadEnabled}
      isLayoutTransitioning={isLayoutTransitioning}
      layoutVersion={layoutVersion}
      markdown={previewMarkdown}
    />
  );
}

function DocumentTocPane({
  headings,
  onSelectHeading,
}: {
  headings: ReturnType<typeof extractHeadings>;
  onSelectHeading: (line: number) => void;
}) {
  const activeEditorLine = useActiveEditorLine();
  const activeHeadingLine = useMemo(
    () => getActiveHeadingLine(headings, activeEditorLine),
    [activeEditorLine, headings],
  );

  return (
    <TocPanel
      activeHeadingLine={activeHeadingLine}
      headings={headings}
      onSelectHeading={onSelectHeading}
    />
  );
}

function DocumentFooterMeta({
  documentStatus,
  headingCount,
  metrics,
}: {
  documentStatus: DocumentStatus | null;
  headingCount: number;
  metrics: ReturnType<typeof summarizeDocument>;
}) {
  const visibleStatusLabel = formatDocumentStatus(documentStatus);

  return (
    <div className="editor-workspace__footer-meta" aria-label="Document summary">
      <span>{visibleStatusLabel}</span>
      <span>{metrics.wordCount} words</span>
      <span>{metrics.lineCount} lines</span>
      <span>{headingCount} headings</span>
    </div>
  );
}

export function EditorWorkspace({
  documentKey,
  documentStore,
  documentStatus,
  editorRef,
  filePath,
  initialPreviewPanelWidth,
  initialTocPanelWidth,
  isExternalMediaAutoLoadEnabled,
  isPreviewVisible,
  isTocVisible,
  onPanelWidthsChange,
  onPathCopy,
  onPathCopyError,
  onEditorFocusChange,
}: EditorWorkspaceProps) {
  const mainRef = useRef<HTMLElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const previewPresence = usePanelPresence(isPreviewVisible);
  const tocPresence = usePanelPresence(isTocVisible);
  const markdown = useDeferredValue(useDocumentMarkdown(documentStore));
  const headings = useMemo(
    () => extractHeadings(markdown),
    [markdown],
  );
  const documentMetrics = useMemo(
    () => summarizeDocument(markdown),
    [markdown],
  );
  const {
    hasRenderedPreview,
    hasRenderedToc,
    isPanelLayoutTransitioning,
    isPreviewExpanded,
    isTocExpanded,
  } = getPanelDisplayState({
    isPreviewVisible,
    isTocVisible,
    previewPresence,
    tocPresence,
  });
  const {
    activeResizer,
    effectivePanelWidths,
    isResizingPanels,
    layoutVersion,
    resizeWithKeyboard,
    startResize,
  } = usePanelResizing({
    containerWidth,
    hasPreview: hasRenderedPreview,
    hasToc: hasRenderedToc,
    initialPreviewPanelWidth,
    initialTocPanelWidth,
    onPanelWidthsChange,
  });
  const tocResizeHandleProps = getPanelResizeHandleProps({
    containerWidth,
    currentWidth: effectivePanelWidths.tocWidth,
    hasPreview: hasRenderedPreview,
    hasToc: hasRenderedToc,
    isActive: activeResizer === "toc",
    isExpanded: isTocExpanded,
    isVisible: isTocVisible,
    kind: "toc",
    siblingWidth: effectivePanelWidths.previewWidth,
  });
  const previewResizeHandleProps = getPanelResizeHandleProps({
    containerWidth,
    currentWidth: effectivePanelWidths.previewWidth,
    hasPreview: hasRenderedPreview,
    hasToc: hasRenderedToc,
    isActive: activeResizer === "preview",
    isExpanded: isPreviewExpanded,
    isVisible: isPreviewVisible,
    kind: "preview",
    siblingWidth: effectivePanelWidths.tocWidth,
  });

  useEffect(() => {
    const container = mainRef.current;
    if (!container) {
      return;
    }

    const updateWidth = () => {
      setContainerWidth(container.clientWidth);
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => {
        window.removeEventListener("resize", updateWidth);
      };
    }

    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  const handlePathCopy = useEffectEvent(async () => {
    if (!filePath) {
      return;
    }

    try {
      await navigator.clipboard.writeText(filePath);
      onPathCopy(filePath);
    } catch {
      onPathCopyError();
    }
  });

  return (
    <EditorViewStateProvider documentKey={documentKey}>
      <div className="editor-workspace">
        <WorkspaceLayout
          hasRenderedPreview={hasRenderedPreview}
          hasRenderedToc={hasRenderedToc}
          isResizingPanels={isResizingPanels}
          mainRef={mainRef}
        >
          <WorkspaceLayout.Toc
            isExpanded={isTocExpanded}
            isVisible={hasRenderedToc}
            onResizeKeyDown={(event) => resizeWithKeyboard("toc", event)}
            onResizePointerDown={(event) => startResize("toc", event)}
            panelState={tocPresence.state}
            resizeHandleProps={tocResizeHandleProps}
            width={isTocVisible ? effectivePanelWidths.tocWidth : 0}
          >
            <DocumentTocPane
              headings={headings}
              onSelectHeading={(line) => editorRef.current?.focusHeadingLine(line)}
            />
          </WorkspaceLayout.Toc>
          <WorkspaceLayout.Editor>
            <section
              className="editor-workspace__panel"
              data-panel="editor"
              id="editor-workspace-editor-panel"
            >
              <div className="editor-workspace__panel-header">
                <div className="editor-workspace__panel-heading">
                  <span className="editor-workspace__panel-kicker">Writing</span>
                </div>
              </div>
              <div className="editor-workspace__panel-body editor-workspace__panel-body--editor">
                <div className="editor-workspace__editor-surface">
                  <MarkdownEditor
                    documentKey={documentKey}
                    onFocusChange={onEditorFocusChange}
                    ref={editorRef}
                    store={documentStore}
                  />
                </div>
              </div>
            </section>
          </WorkspaceLayout.Editor>
          <WorkspaceLayout.Preview
            isExpanded={isPreviewExpanded}
            isVisible={hasRenderedPreview}
            onResizeKeyDown={(event) => resizeWithKeyboard("preview", event)}
            onResizePointerDown={(event) => startResize("preview", event)}
            panelState={previewPresence.state}
            resizeHandleProps={previewResizeHandleProps}
            width={isPreviewVisible ? effectivePanelWidths.previewWidth : 0}
          >
            <div className="editor-workspace__panel-header">
              <div className="editor-workspace__panel-heading">
                <span className="editor-workspace__panel-kicker">Reading</span>
              </div>
            </div>
            <div className="editor-workspace__panel-body">
              <DocumentPreviewPane
                markdown={markdown}
                filePath={filePath}
                isExternalMediaAutoLoadEnabled={isExternalMediaAutoLoadEnabled}
                isLayoutTransitioning={isPanelLayoutTransitioning}
                layoutVersion={layoutVersion}
              />
            </div>
          </WorkspaceLayout.Preview>
        </WorkspaceLayout>

        <footer className="editor-workspace__footer">
          <div className="editor-workspace__footer-primary">
            <span className="editor-workspace__footer-label">File</span>
            {filePath ? (
              <button
                className="editor-workspace__path-button"
                onClick={() => void handlePathCopy()}
                title="Click to copy file path"
                type="button"
              >
                {filePath}
              </button>
            ) : (
              <span className="editor-workspace__footer-value">{getFileLabel(filePath)}</span>
            )}
          </div>
          <DocumentFooterMeta
            documentStatus={documentStatus}
            headingCount={headings.length}
            metrics={documentMetrics}
          />
        </footer>
      </div>
    </EditorViewStateProvider>
  );
}
