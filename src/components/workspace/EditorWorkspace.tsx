import type { RefObject } from "react";
import { useDeferredValue, useEffectEvent, useMemo } from "react";
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

const PREVIEW_DEBOUNCE_MS = 120;
const PREVIEW_IDLE_TIMEOUT_MS = 250;

type EditorWorkspaceProps = {
  documentKey: number;
  documentStore: DocumentStore;
  documentStatus: DocumentStatus | null;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  filePath: string | null;
  isExternalMediaAutoLoadEnabled: boolean;
  isPreviewVisible: boolean;
  isTocVisible: boolean;
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
  documentStore,
  filePath,
  isExternalMediaAutoLoadEnabled,
}: {
  documentStore: DocumentStore;
  filePath: string | null;
  isExternalMediaAutoLoadEnabled: boolean;
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
  isExternalMediaAutoLoadEnabled,
  isPreviewVisible,
  isTocVisible,
  onPathCopy,
  onPathCopyError,
  onEditorFocusChange,
}: EditorWorkspaceProps) {
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
        <main
          className="editor-workspace__main"
          data-has-preview={isPreviewVisible}
          data-has-toc={isTocVisible}
        >
          {isTocVisible ? (
            <DocumentTocPane
              documentStore={documentStore}
              onSelectHeading={(line) => editorRef.current?.focusHeadingLine(line)}
            />
          ) : null}
          <section
            className="editor-workspace__panel"
            data-panel="editor"
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
            <section className="editor-workspace__panel" data-panel="preview">
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
                />
              </div>
            </section>
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
