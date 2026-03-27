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
type PanelVisibilityState = "closed" | "entering" | "closing" | "open";

type PanelWidthsState = {
  preview: number | null;
  toc: number | null;
};

function getReducedMotionPreference() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function parseDurationMs(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return 0;
  }

  if (normalized.endsWith("ms")) {
    const parsed = Number(normalized.slice(0, -2));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (normalized.endsWith("s")) {
    const parsed = Number(normalized.slice(0, -1));
    return Number.isFinite(parsed) ? parsed * 1000 : 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getPanelExitTransitionMs() {
  if (typeof window === "undefined" || typeof getComputedStyle !== "function") {
    return 220;
  }

  const rootStyles = getComputedStyle(document.documentElement);
  const durations = [
    rootStyles.getPropertyValue("--duration-panel-width-exit"),
    rootStyles.getPropertyValue("--duration-panel-content-exit"),
    rootStyles.getPropertyValue("--duration-panel-handle-exit"),
  ].map(parseDurationMs);

  return Math.max(...durations, 220);
}

function usePanelPresence(isVisible: boolean) {
  const [state, setState] = useState<PanelVisibilityState>(isVisible ? "open" : "closed");

  useEffect(() => {
    if (isVisible) {
      setState((current) => {
        if (current === "open") {
          return current;
        }

        return getReducedMotionPreference() ? "open" : "entering";
      });

      if (getReducedMotionPreference()) {
        return;
      }

      const frameId = window.requestAnimationFrame(() => {
        setState("open");
      });

      return () => {
        window.cancelAnimationFrame(frameId);
      };
    }

    if (state === "closed") {
      return;
    }

    setState("closing");

    if (getReducedMotionPreference()) {
      setState("closed");
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setState("closed");
    }, getPanelExitTransitionMs());

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isVisible, state]);

  return {
    isMounted: state !== "closed",
    state,
  };
}

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
  isLayoutTransitioning,
  layoutVersion,
}: {
  documentStore: DocumentStore;
  filePath: string | null;
  isExternalMediaAutoLoadEnabled: boolean;
  isLayoutTransitioning: boolean;
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
      isLayoutTransitioning={isLayoutTransitioning}
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
  const previewPresence = usePanelPresence(isPreviewVisible);
  const tocPresence = usePanelPresence(isTocVisible);
  const hasRenderedPreview = previewPresence.isMounted;
  const hasRenderedToc = tocPresence.isMounted;
  const isPreviewExpanded = isPreviewVisible && previewPresence.state !== "entering";
  const isTocExpanded = isTocVisible && tocPresence.state !== "entering";
  const isPanelLayoutTransitioning =
    previewPresence.state === "entering" ||
    previewPresence.state === "closing" ||
    tocPresence.state === "entering" ||
    tocPresence.state === "closing";
  const isResizingPanels = activeResizer !== null;

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
      hasPreview: hasRenderedPreview,
      hasToc: hasRenderedToc,
      previewWidth: panelWidths.preview,
      tocWidth: panelWidths.toc,
    });
  }, [
    containerWidth,
    hasRenderedPreview,
    hasRenderedToc,
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
        hasPreview: hasRenderedPreview,
        hasToc: hasRenderedToc,
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
    hasRenderedPreview,
    hasRenderedToc,
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
      hasPreview: hasRenderedPreview,
      hasToc: hasRenderedToc,
      kind,
      siblingWidth,
    });

    let nextWidth: number | null = null;

    if (event.key === "Home") {
      nextWidth = clampPanelWidth(kind, 0, {
        containerWidth,
        hasPreview: hasRenderedPreview,
        hasToc: hasRenderedToc,
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
      hasPreview: hasRenderedPreview,
      hasToc: hasRenderedToc,
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
          data-has-preview={hasRenderedPreview}
          data-has-toc={hasRenderedToc}
          data-resizing={isResizingPanels}
          ref={mainRef}
        >
          {hasRenderedToc ? (
            <>
              <div
                className="editor-workspace__panel-shell"
                data-expanded={isTocExpanded}
                data-panel-state={tocPresence.state}
                data-panel-kind="toc"
                style={{
                  width: `${isTocVisible ? (effectivePanelWidths.tocWidth ?? 0) : 0}px`,
                }}
              >
                <DocumentTocPane
                  documentStore={documentStore}
                  onSelectHeading={(line) => editorRef.current?.focusHeadingLine(line)}
                />
              </div>
              {hasRenderedToc ? (
                <div
                  aria-controls="editor-workspace-editor-panel"
                  aria-label="Resize table of contents panel"
                  aria-orientation="vertical"
                  aria-valuemax={getMaxAllowedPanelWidth({
                    containerWidth,
                    hasPreview: hasRenderedPreview,
                    hasToc: hasRenderedToc,
                    kind: "toc",
                    siblingWidth: effectivePanelWidths.previewWidth,
                  })}
                  aria-valuemin={clampPanelWidth("toc", 0, {
                    containerWidth,
                    hasPreview: hasRenderedPreview,
                    hasToc: hasRenderedToc,
                    siblingWidth: effectivePanelWidths.previewWidth,
                  })}
                  aria-valuenow={effectivePanelWidths.tocWidth ?? undefined}
                  className="editor-workspace__resize-handle"
                  data-active={activeResizer === "toc"}
                  data-expanded={isTocExpanded}
                  data-panel-resizer="toc"
                  onKeyDown={(event) => resizeWithKeyboard("toc", event)}
                  onPointerDown={(event) => startResize("toc", event)}
                  role="separator"
                  tabIndex={isTocVisible ? 0 : -1}
                />
              ) : null}
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
          {hasRenderedPreview ? (
            <>
              {hasRenderedPreview ? (
                <div
                  aria-controls="editor-workspace-editor-panel"
                  aria-label="Resize preview panel"
                  aria-orientation="vertical"
                  aria-valuemax={getMaxAllowedPanelWidth({
                    containerWidth,
                    hasPreview: hasRenderedPreview,
                    hasToc: hasRenderedToc,
                    kind: "preview",
                    siblingWidth: effectivePanelWidths.tocWidth,
                  })}
                  aria-valuemin={clampPanelWidth("preview", 0, {
                    containerWidth,
                    hasPreview: hasRenderedPreview,
                    hasToc: hasRenderedToc,
                    siblingWidth: effectivePanelWidths.tocWidth,
                  })}
                  aria-valuenow={effectivePanelWidths.previewWidth ?? undefined}
                  className="editor-workspace__resize-handle"
                  data-active={activeResizer === "preview"}
                  data-expanded={isPreviewExpanded}
                  data-panel-resizer="preview"
                  onKeyDown={(event) => resizeWithKeyboard("preview", event)}
                  onPointerDown={(event) => startResize("preview", event)}
                  role="separator"
                  tabIndex={isPreviewVisible ? 0 : -1}
                />
              ) : null}
              <section
                className="editor-workspace__panel editor-workspace__panel--preview"
                data-panel="preview"
                data-expanded={isPreviewExpanded}
                data-panel-state={previewPresence.state}
                style={{
                  width: `${isPreviewVisible ? (effectivePanelWidths.previewWidth ?? 0) : 0}px`,
                }}
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
                    isLayoutTransitioning={isPanelLayoutTransitioning}
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
