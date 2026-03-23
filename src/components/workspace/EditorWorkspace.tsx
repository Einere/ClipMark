import type { RefObject } from "react";
import { useDeferredValue, useEffectEvent, useMemo } from "react";
import type { MarkdownEditorHandle } from "../editor/MarkdownEditor";
import { MarkdownEditor } from "../editor/MarkdownEditor";
import { MarkdownPreview } from "../preview/MarkdownPreview";
import { TocPanel } from "../toc/TocPanel";
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

  const workspaceClassName = [
    "workspace",
    isTocVisible && isPreviewVisible
      ? "workspace--all"
      : isTocVisible
        ? "workspace--toc-editor"
        : isPreviewVisible
          ? "workspace--editor-preview"
          : "workspace--editor-only",
  ].join(" ");

  return (
    <>
      <main className={workspaceClassName}>
        {isTocVisible ? (
          <DocumentTocPane
            documentStore={documentStore}
            onSelectHeading={(line) => editorRef.current?.focusHeadingLine(line)}
          />
        ) : null}
        <section className="panel panel--editor">
          <div className="panel__header">
            <span>Editor</span>
            {documentStatus ? (
              <span
                className={
                  documentStatus === "edited"
                    ? "status status--dirty"
                    : "status"
                }
              >
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
          <section className="panel panel--preview">
            <div className="panel__header">
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

      <footer className="footer-bar">
        {filePath ? (
          <button
            className="footer-bar__path footer-bar__path-button"
            onClick={() => void handlePathCopy()}
            title="Click to copy file path"
            type="button"
          >
            {filePath}
          </button>
        ) : (
          <span className="footer-bar__path">Unsaved local document</span>
        )}
      </footer>
    </>
  );
}
