import type { RefObject } from "react";
import { useDeferredValue, useEffectEvent, useMemo } from "react";
import type { MarkdownEditorHandle } from "../editor/MarkdownEditor";
import { MarkdownEditor } from "../editor/MarkdownEditor";
import { MarkdownPreview } from "../preview/MarkdownPreview";
import { TocPanel } from "../toc/TocPanel";
import {
  designSystem,
  getStatusClasses,
  getWorkspaceLayoutClasses,
} from "../../lib/design-system";
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

  const workspaceClassName = getWorkspaceLayoutClasses({
    isPreviewVisible,
    isTocVisible,
  });

  return (
    <>
      <main className={workspaceClassName}>
        {isTocVisible ? (
          <DocumentTocPane
            documentStore={documentStore}
            onSelectHeading={(line) => editorRef.current?.focusHeadingLine(line)}
          />
        ) : null}
        <section className={designSystem.panel}>
          <div className={designSystem.panelHeader}>
            <span>Editor</span>
            {documentStatus ? (
              <span className={getStatusClasses(documentStatus === "edited")}>
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
          <section className={designSystem.panel}>
            <div className={designSystem.panelHeader}>
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

      <footer className={designSystem.footerBar}>
        {filePath ? (
          <button
            className={`${designSystem.footerPath} ${designSystem.footerPathButton}`}
            onClick={() => void handlePathCopy()}
            title="Click to copy file path"
            type="button"
          >
            {filePath}
          </button>
        ) : (
          <span className={designSystem.footerPath}>Unsaved local document</span>
        )}
      </footer>
    </>
  );
}
