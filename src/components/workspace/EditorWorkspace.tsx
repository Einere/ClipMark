import type { RefObject } from "react";
import { useDeferredValue, useEffectEvent, useMemo, useState } from "react";
import type { MarkdownEditorHandle } from "../editor/MarkdownEditor";
import { MarkdownEditor } from "../editor/MarkdownEditor";
import { MarkdownPreview } from "../preview/MarkdownPreview";
import { TocPanel } from "../toc/TocPanel";
import type { DocumentStore } from "../../lib/document-store";
import { useDocumentMarkdown } from "../../lib/document-store";
import { extractHeadings } from "../../lib/toc";
import { summarizeDocument } from "../../lib/document-metrics";
import type { DocumentStatus } from "../../lib/window-state";

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
  markdown,
  filePath,
  isExternalMediaAutoLoadEnabled,
}: {
  markdown: string;
  filePath: string | null;
  isExternalMediaAutoLoadEnabled: boolean;
}) {
  return (
    <MarkdownPreview
      filePath={filePath}
      isExternalMediaAutoLoadEnabled={isExternalMediaAutoLoadEnabled}
      markdown={markdown}
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
  return <TocPanel headings={headings} onSelectHeading={onSelectHeading} />;
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
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const markdown = useDocumentMarkdown(documentStore);
  const deferredMarkdown = useDeferredValue(markdown);
  const headings = useMemo(
    () => extractHeadings(deferredMarkdown),
    [deferredMarkdown],
  );
  const documentMetrics = useMemo(
    () => summarizeDocument(markdown),
    [markdown],
  );
  const handleEditorFocus = useEffectEvent((focused: boolean) => {
    setIsEditorFocused(focused);
    onEditorFocusChange(focused);
  });
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
  const fileLabel = getFileLabel(filePath);
  const visibleStatusLabel = formatDocumentStatus(documentStatus);

  return (
    <div className="editor-workspace">
      <main
        className="editor-workspace__main"
        data-has-preview={isPreviewVisible}
        data-has-toc={isTocVisible}
      >
        {isTocVisible ? (
          <DocumentTocPane
            headings={headings}
            onSelectHeading={(line) => editorRef.current?.focusHeadingLine(line)}
          />
        ) : null}
        <section
          className="editor-workspace__panel"
          data-focused={isEditorFocused}
          data-panel="editor"
        >
          <div className="editor-workspace__panel-header">
            <div className="editor-workspace__panel-heading">
              <span className="editor-workspace__panel-kicker">Writing</span>
              <div className="editor-workspace__panel-title-row">
                <span className="editor-workspace__panel-title">Editor</span>
                <span className="editor-workspace__status" data-status={documentStatus ?? "initial"}>
                  {visibleStatusLabel}
                </span>
              </div>
            </div>
            <dl className="editor-workspace__metrics" aria-label="Editor metrics">
              <div>
                <dt>Words</dt>
                <dd>{documentMetrics.wordCount}</dd>
              </div>
              <div>
                <dt>Read</dt>
                <dd>{documentMetrics.estimatedReadingMinutes} min</dd>
              </div>
            </dl>
          </div>
          <div className="editor-workspace__panel-body">
            <MarkdownEditor
              documentKey={documentKey}
              onFocusChange={handleEditorFocus}
              ref={editorRef}
              store={documentStore}
            />
          </div>
        </section>
        {isPreviewVisible ? (
          <section className="editor-workspace__panel" data-panel="preview">
            <div className="editor-workspace__panel-header">
              <div className="editor-workspace__panel-heading">
                <span className="editor-workspace__panel-kicker">Reading</span>
                <div className="editor-workspace__panel-title-row">
                  <span className="editor-workspace__panel-title">Preview</span>
                </div>
              </div>
              <dl className="editor-workspace__metrics" aria-label="Preview metrics">
                <div>
                  <dt>Headings</dt>
                  <dd>{headings.length}</dd>
                </div>
                <div>
                  <dt>Chars</dt>
                  <dd>{documentMetrics.characterCount}</dd>
                </div>
              </dl>
            </div>
            <div className="editor-workspace__panel-body">
              <DocumentPreviewPane
                markdown={deferredMarkdown}
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
              {fileLabel}
            </button>
          ) : (
            <span className="editor-workspace__footer-value">{fileLabel}</span>
          )}
        </div>
        <div className="editor-workspace__footer-meta" aria-label="Document summary">
          <span>{visibleStatusLabel}</span>
          <span>{documentMetrics.wordCount} words</span>
          <span>{headings.length} headings</span>
        </div>
      </footer>
    </div>
  );
}
