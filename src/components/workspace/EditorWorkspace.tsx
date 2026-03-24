import type { RefObject } from "react";
import { useDeferredValue, useEffectEvent, useMemo } from "react";
import type { MarkdownEditorHandle } from "../editor/MarkdownEditor";
import { MarkdownEditor } from "../editor/MarkdownEditor";
import { MarkdownPreview } from "../preview/MarkdownPreview";
import { TocPanel } from "../toc/TocPanel";
import { cn } from "../../lib/cn";
import type { DocumentStore } from "../../lib/document-store";
import { useDocumentMarkdown } from "../../lib/document-store";
import { extractHeadings } from "../../lib/toc";
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

function DocumentPreviewPane({
  documentStore,
  filePath,
  isExternalMediaAutoLoadEnabled,
}: {
  documentStore: DocumentStore;
  filePath: string | null;
  isExternalMediaAutoLoadEnabled: boolean;
}) {
  const markdown = useDocumentMarkdown(documentStore);
  const deferredMarkdown = useDeferredValue(markdown);

  return (
    <MarkdownPreview
      filePath={filePath}
      isExternalMediaAutoLoadEnabled={isExternalMediaAutoLoadEnabled}
      markdown={deferredMarkdown}
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
  const markdown = useDocumentMarkdown(documentStore);
  const deferredMarkdown = useDeferredValue(markdown);
  const headings = useMemo(
    () => extractHeadings(deferredMarkdown),
    [deferredMarkdown],
  );

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

  const workspaceClassName = cn(
    "grid min-h-0 gap-4",
    isTocVisible
      ? isPreviewVisible
        ? "grid-cols-1 xl:grid-cols-[minmax(14rem,15rem)_minmax(0,1.08fr)_minmax(21.25rem,0.88fr)]"
        : "grid-cols-1 xl:grid-cols-[minmax(14rem,15rem)_minmax(0,1fr)]"
      : isPreviewVisible
        ? "grid-cols-1 xl:grid-cols-[minmax(0,1.16fr)_minmax(21.25rem,0.84fr)]"
        : "grid-cols-1",
  );

  const documentStatusClassName = cn(
    "cm-status",
    documentStatus === "edited" && "cm-status-dirty",
  );

  return (
    <>
      <main className={workspaceClassName}>
        {isTocVisible ? (
          <DocumentTocPane
            documentStore={documentStore}
            onSelectHeading={(line) => editorRef.current?.focusHeadingLine(line)}
          />
        ) : null}
        <section className="cm-panel">
          <div className="cm-panel-header">
            <span>Editor</span>
            {documentStatus ? (
              <span className={documentStatusClassName}>
                {documentStatus}
              </span>
            ) : null}
          </div>
          <MarkdownEditor
            documentKey={documentKey}
            onFocusChange={onEditorFocusChange}
            ref={editorRef}
            store={documentStore}
          />
        </section>
        {isPreviewVisible ? (
          <section className="cm-panel">
            <div className="cm-panel-header">
              <span>Preview</span>
            </div>
            <DocumentPreviewPane
              documentStore={documentStore}
              filePath={filePath}
              isExternalMediaAutoLoadEnabled={isExternalMediaAutoLoadEnabled}
            />
          </section>
        ) : null}
      </main>

      <footer className="cm-footer-bar">
        {filePath ? (
          <button
            className="cm-footer-path cm-footer-path-button"
            onClick={() => void handlePathCopy()}
            title="Click to copy file path"
            type="button"
          >
            {filePath}
          </button>
        ) : (
          <span className="cm-footer-path">Unsaved local document</span>
        )}
      </footer>
    </>
  );
}
