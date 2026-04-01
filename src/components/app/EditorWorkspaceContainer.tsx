import { lazy, Suspense } from "react";
import type { RefObject } from "react";
import { useToast } from "../toast/ToastProvider";
import { AppShellFallback } from "./AppShellFallback";
import type { MarkdownEditorHandle } from "../editor/MarkdownEditor";
import type { DocumentStore } from "../../lib/document-store";
import type { DocumentStatus } from "../../lib/window-state";

const EditorWorkspace = lazy(() => import("../workspace/EditorWorkspace")
  .then((module) => ({ default: module.EditorWorkspace })));

type EditorWorkspaceContainerProps = {
  documentKey: number;
  documentStatus: DocumentStatus | null;
  documentStore: DocumentStore;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  filePath: string | null;
  initialPreviewPanelWidth: number | null;
  initialTocPanelWidth: number | null;
  isExternalMediaAutoLoadEnabled: boolean;
  isPreviewVisible: boolean;
  isTocVisible: boolean;
  onEditorFocusChange: (focused: boolean) => void;
  setPreviewPanelWidth: (width: number | null) => void;
  setTocPanelWidth: (width: number | null) => void;
};

export function EditorWorkspaceContainer({
  documentKey,
  documentStatus,
  documentStore,
  editorRef,
  filePath,
  initialPreviewPanelWidth,
  initialTocPanelWidth,
  isExternalMediaAutoLoadEnabled,
  isPreviewVisible,
  isTocVisible,
  onEditorFocusChange,
  setPreviewPanelWidth,
  setTocPanelWidth,
}: EditorWorkspaceContainerProps) {
  const { showToast } = useToast();

  return (
    <Suspense fallback={<AppShellFallback />}>
      <EditorWorkspace
        documentKey={documentKey}
        documentStatus={documentStatus}
        documentStore={documentStore}
        editorRef={editorRef}
        filePath={filePath}
        initialPreviewPanelWidth={initialPreviewPanelWidth}
        initialTocPanelWidth={initialTocPanelWidth}
        isExternalMediaAutoLoadEnabled={isExternalMediaAutoLoadEnabled}
        isPreviewVisible={isPreviewVisible}
        isTocVisible={isTocVisible}
        onEditorFocusChange={onEditorFocusChange}
        onPanelWidthsChange={({ previewPanelWidth, tocPanelWidth }) => {
          setPreviewPanelWidth(previewPanelWidth);
          setTocPanelWidth(tocPanelWidth);
        }}
        onPathCopy={() => showToast("Copied the file path to the clipboard.", "success")}
        onPathCopyError={() => showToast("Could not copy the file path.", "error")}
      />
    </Suspense>
  );
}
