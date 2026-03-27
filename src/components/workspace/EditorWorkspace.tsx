import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, RefObject } from "react";
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
  clampPanelWidth,
  getEffectivePanelWidths,
  getMaxAllowedPanelWidth,
} from "./panel-layout";

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

type PanelKind = "preview" | "toc";

type PanelWidthsState = {
  preview: number | null;
  toc: number | null;
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
  documentStore,
  filePath,
  isExternalMediaAutoLoadEnabled,
  layoutVersion,
}: {
  documentStore: DocumentStore;
  filePath: string | null;
  isExternalMediaAutoLoadEnabled: boolean;
  layoutVersion: number;
}) {
  const { activeLine, isFocused } = useEditorViewState();
  const markdown = useDeferredValue(useDocumentMarkdown(documentStore));
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
      layoutVersion={layoutVersion}
      markdown={previewMarkdown}
    />
  );
}

function DocumentTocPane({
  documentStore,
  onSelectHeading,
}: {
  documentStore: DocumentStore;
  onSelectHeading: (line: number) => void;
}) {
  const activeEditorLine = useActiveEditorLine();
  const markdown = useDeferredValue(useDocumentMarkdown(documentStore));
  const headings = useMemo(
    () => extractHeadings(markdown),
    [markdown],
  );
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
  documentStore,
}: {
  documentStatus: DocumentStatus | null;
  documentStore: DocumentStore;
}) {
  const markdown = useDeferredValue(useDocumentMarkdown(documentStore));
  const headings = useMemo(
    () => extractHeadings(markdown),
    [markdown],
  );
  const documentMetrics = useMemo(
    () => summarizeDocument(markdown),
    [markdown],
  );
  const visibleStatusLabel = formatDocumentStatus(documentStatus);

  return (
    <div className="editor-workspace__footer-meta" aria-label="Document summary">
      <span>{visibleStatusLabel}</span>
      <span>{documentMetrics.wordCount} words</span>
      <span>{documentMetrics.lineCount} lines</span>
      <span>{headings.length} headings</span>
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
  const dragStateRef = useRef<{
    initialWidth: number;
    kind: PanelKind;
    pointerId: number;
    startX: number;
  } | null>(null);
  const latestPanelWidthsRef = useRef<PanelWidthsState>({
    preview: initialPreviewPanelWidth,
    toc: initialTocPanelWidth,
  });
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [activeResizer, setActiveResizer] = useState<PanelKind | null>(null);
  const [panelWidths, setPanelWidths] = useState<PanelWidthsState>({
    preview: initialPreviewPanelWidth,
    toc: initialTocPanelWidth,
  });

  useEffect(() => {
    setPanelWidths({
      preview: initialPreviewPanelWidth,
      toc: initialTocPanelWidth,
    });
    latestPanelWidthsRef.current = {
      preview: initialPreviewPanelWidth,
      toc: initialTocPanelWidth,
    };
  }, [initialPreviewPanelWidth, initialTocPanelWidth]);

  const effectivePanelWidths = useMemo(() => {
    return getEffectivePanelWidths({
      containerWidth,
      hasPreview: isPreviewVisible,
      hasToc: isTocVisible,
      previewWidth: panelWidths.preview,
      tocWidth: panelWidths.toc,
    });
  }, [
    containerWidth,
    isPreviewVisible,
    isTocVisible,
    panelWidths.preview,
    panelWidths.toc,
  ]);

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

  const commitPanelWidths = useEffectEvent((nextPanelWidths: PanelWidthsState) => {
    onPanelWidthsChange({
      previewPanelWidth: nextPanelWidths.preview,
      tocPanelWidth: nextPanelWidths.toc,
    });
  });

  const applyPanelWidth = useEffectEvent((kind: PanelKind, nextWidth: number) => {
    setPanelWidths((current) => {
      const nextPanelWidths = kind === "toc"
        ? {
            ...current,
            toc: nextWidth,
          }
        : {
            ...current,
            preview: nextWidth,
          };

      latestPanelWidthsRef.current = nextPanelWidths;

      return nextPanelWidths;
    });
  });

  const updatePanelWidths = useEffectEvent((nextPanelWidths: PanelWidthsState) => {
    latestPanelWidthsRef.current = nextPanelWidths;
    setPanelWidths(nextPanelWidths);
  });

  const finalizeResize = useEffectEvent(() => {
    dragStateRef.current = null;
    setActiveResizer(null);
    setLayoutVersion((version) => version + 1);
    commitPanelWidths(latestPanelWidthsRef.current);
  });

  useEffect(() => {
    latestPanelWidthsRef.current = panelWidths;
  }, [panelWidths]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) {
        return;
      }

      const deltaX = event.clientX - dragState.startX;
      const requestedWidth = dragState.kind === "toc"
        ? dragState.initialWidth + deltaX
        : dragState.initialWidth - deltaX;
      const nextWidth = clampPanelWidth(dragState.kind, requestedWidth, {
        containerWidth,
        hasPreview: isPreviewVisible,
        hasToc: isTocVisible,
        siblingWidth: dragState.kind === "toc"
          ? effectivePanelWidths.previewWidth
          : effectivePanelWidths.tocWidth,
      });

      applyPanelWidth(dragState.kind, nextWidth);
    };

    const handlePointerUp = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      finalizeResize();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [
    applyPanelWidth,
    containerWidth,
    effectivePanelWidths.previewWidth,
    effectivePanelWidths.tocWidth,
    finalizeResize,
    isPreviewVisible,
    isTocVisible,
  ]);

  function startResize(kind: PanelKind, event: ReactPointerEvent<HTMLDivElement>) {
    const initialWidth = kind === "toc"
      ? effectivePanelWidths.tocWidth
      : effectivePanelWidths.previewWidth;
    if (initialWidth === null) {
      return;
    }

    dragStateRef.current = {
      initialWidth,
      kind,
      pointerId: event.pointerId,
      startX: event.clientX,
    };
    setActiveResizer(kind);
    event.preventDefault();
  }

  function resizeWithKeyboard(kind: PanelKind, event: ReactKeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 48 : 16;
    const currentWidth = kind === "toc"
      ? effectivePanelWidths.tocWidth
      : effectivePanelWidths.previewWidth;

    if (currentWidth === null) {
      return;
    }

    const siblingWidth = kind === "toc"
      ? effectivePanelWidths.previewWidth
      : effectivePanelWidths.tocWidth;
    const maxWidth = getMaxAllowedPanelWidth({
      containerWidth,
      hasPreview: isPreviewVisible,
      hasToc: isTocVisible,
      kind,
      siblingWidth,
    });

    let nextWidth: number | null = null;

    if (event.key === "Home") {
      nextWidth = clampPanelWidth(kind, 0, {
        containerWidth,
        hasPreview: isPreviewVisible,
        hasToc: isTocVisible,
        siblingWidth,
      });
    } else if (event.key === "End") {
      nextWidth = maxWidth;
    } else if (kind === "toc" && event.key === "ArrowLeft") {
      nextWidth = currentWidth - step;
    } else if (kind === "toc" && event.key === "ArrowRight") {
      nextWidth = currentWidth + step;
    } else if (kind === "preview" && event.key === "ArrowLeft") {
      nextWidth = currentWidth + step;
    } else if (kind === "preview" && event.key === "ArrowRight") {
      nextWidth = currentWidth - step;
    }

    if (nextWidth === null) {
      return;
    }

    event.preventDefault();

    const clampedWidth = clampPanelWidth(kind, nextWidth, {
      containerWidth,
      hasPreview: isPreviewVisible,
      hasToc: isTocVisible,
      siblingWidth,
    });
    const nextPanelWidths = kind === "toc"
      ? { ...panelWidths, toc: clampedWidth }
      : { ...panelWidths, preview: clampedWidth };

    updatePanelWidths(nextPanelWidths);
    setLayoutVersion((version) => version + 1);
    commitPanelWidths(nextPanelWidths);
  }

  return (
    <EditorViewStateProvider documentKey={documentKey}>
      <div className="editor-workspace">
        <main
          className="editor-workspace__main"
          data-has-preview={isPreviewVisible}
          data-has-toc={isTocVisible}
          ref={mainRef}
        >
          {isTocVisible ? (
            <>
              <div
                className="editor-workspace__panel-shell"
                style={{ width: `${effectivePanelWidths.tocWidth ?? 0}px` }}
              >
                <DocumentTocPane
                  documentStore={documentStore}
                  onSelectHeading={(line) => editorRef.current?.focusHeadingLine(line)}
                />
              </div>
              <div
                aria-controls="editor-workspace-editor-panel"
                aria-label="Resize table of contents panel"
                aria-orientation="vertical"
                aria-valuemax={getMaxAllowedPanelWidth({
                  containerWidth,
                  hasPreview: isPreviewVisible,
                  hasToc: isTocVisible,
                  kind: "toc",
                  siblingWidth: effectivePanelWidths.previewWidth,
                })}
                aria-valuemin={clampPanelWidth("toc", 0, {
                  containerWidth,
                  hasPreview: isPreviewVisible,
                  hasToc: isTocVisible,
                  siblingWidth: effectivePanelWidths.previewWidth,
                })}
                aria-valuenow={effectivePanelWidths.tocWidth ?? undefined}
                className="editor-workspace__resize-handle"
                data-active={activeResizer === "toc"}
                data-panel-resizer="toc"
                onKeyDown={(event) => resizeWithKeyboard("toc", event)}
                onPointerDown={(event) => startResize("toc", event)}
                role="separator"
                tabIndex={0}
              />
            </>
          ) : null}
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
          {isPreviewVisible ? (
            <>
              <div
                aria-controls="editor-workspace-editor-panel"
                aria-label="Resize preview panel"
                aria-orientation="vertical"
                aria-valuemax={getMaxAllowedPanelWidth({
                  containerWidth,
                  hasPreview: isPreviewVisible,
                  hasToc: isTocVisible,
                  kind: "preview",
                  siblingWidth: effectivePanelWidths.tocWidth,
                })}
                aria-valuemin={clampPanelWidth("preview", 0, {
                  containerWidth,
                  hasPreview: isPreviewVisible,
                  hasToc: isTocVisible,
                  siblingWidth: effectivePanelWidths.tocWidth,
                })}
                aria-valuenow={effectivePanelWidths.previewWidth ?? undefined}
                className="editor-workspace__resize-handle"
                data-active={activeResizer === "preview"}
                data-panel-resizer="preview"
                onKeyDown={(event) => resizeWithKeyboard("preview", event)}
                onPointerDown={(event) => startResize("preview", event)}
                role="separator"
                tabIndex={0}
              />
              <section
                className="editor-workspace__panel editor-workspace__panel--preview"
                data-panel="preview"
                style={{ width: `${effectivePanelWidths.previewWidth ?? 0}px` }}
              >
                <div className="editor-workspace__panel-header">
                  <div className="editor-workspace__panel-heading">
                    <span className="editor-workspace__panel-kicker">Reading</span>
                  </div>
                </div>
                <div className="editor-workspace__panel-body">
                  <DocumentPreviewPane
                    documentStore={documentStore}
                    filePath={filePath}
                    isExternalMediaAutoLoadEnabled={isExternalMediaAutoLoadEnabled}
                    layoutVersion={layoutVersion}
                  />
                </div>
              </section>
            </>
          ) : null}
        </main>

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
            documentStore={documentStore}
          />
        </footer>
      </div>
    </EditorViewStateProvider>
  );
}
