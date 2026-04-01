import { lazy, Suspense } from "react";
import type { ChangeEventHandler, RefObject } from "react";
import { UnsavedChangesDialog } from "../dialog/UnsavedChangesDialog";
import type { MarkdownEditorHandle } from "../editor/MarkdownEditor";
import { Toast } from "../ui/Toast";
import { WelcomeScreen } from "../welcome/WelcomeScreen";
import { AppShellFallback } from "./AppShellFallback";
import type { DocumentStore } from "../../lib/document-store";
import type { RecentFile } from "../../lib/recent-files";
import type { DocumentStatus } from "../../lib/window-state";

const EditorWorkspace = lazy(() => import("../workspace/EditorWorkspace")
  .then((module) => ({ default: module.EditorWorkspace })));

type AppContentProps = {
  dialog: {
    confirmLabel: string;
    description: string;
    filename: string;
    onDiscard: () => void;
    onSave: () => void;
    open: boolean;
    title: string;
  };
  editor: {
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
    onPanelWidthsChange: (widths: {
      previewPanelWidth: number | null;
      tocPanelWidth: number | null;
    }) => void;
    onPathCopy: () => void;
    onPathCopyError: () => void;
  };
  fileInput: {
    onChange: ChangeEventHandler<HTMLInputElement>;
    ref: RefObject<HTMLInputElement | null>;
  };
  toast: {
    id: number;
    message: string;
    onExitComplete: () => void;
    phase: "enter" | "exit";
    title?: string;
    variant: "error" | "info" | "success" | "warning";
  } | null;
  welcome: {
    isVisible: boolean;
    onNew: () => void;
    onOpen: () => void;
    onOpenRecent: (path: string) => void;
    recentFiles: RecentFile[];
  };
};

export function AppContent({
  dialog,
  editor,
  fileInput,
  toast,
  welcome,
}: AppContentProps) {
  return (
    <div className="app-shell">
      {welcome.isVisible ? (
        <WelcomeScreen
          onNew={welcome.onNew}
          onOpen={welcome.onOpen}
          onOpenRecent={welcome.onOpenRecent}
          recentFiles={welcome.recentFiles}
        />
      ) : (
        <Suspense fallback={<AppShellFallback />}>
          <EditorWorkspace
            documentKey={editor.documentKey}
            documentStatus={editor.documentStatus}
            documentStore={editor.documentStore}
            editorRef={editor.editorRef}
            filePath={editor.filePath}
            initialPreviewPanelWidth={editor.initialPreviewPanelWidth}
            initialTocPanelWidth={editor.initialTocPanelWidth}
            isExternalMediaAutoLoadEnabled={editor.isExternalMediaAutoLoadEnabled}
            isPreviewVisible={editor.isPreviewVisible}
            isTocVisible={editor.isTocVisible}
            onEditorFocusChange={editor.onEditorFocusChange}
            onPanelWidthsChange={editor.onPanelWidthsChange}
            onPathCopy={editor.onPathCopy}
            onPathCopyError={editor.onPathCopyError}
          />
        </Suspense>
      )}

      <UnsavedChangesDialog
        confirmLabel={dialog.confirmLabel}
        description={dialog.description}
        filename={dialog.filename}
        onDiscard={dialog.onDiscard}
        onSave={dialog.onSave}
        open={dialog.open}
        title={dialog.title}
      />

      <input
        accept=".md,text/markdown,text/plain"
        hidden
        onChange={fileInput.onChange}
        ref={fileInput.ref}
        type="file"
      />

      {toast ? (
        <Toast
          key={toast.id}
          message={toast.message}
          onExitComplete={toast.onExitComplete}
          phase={toast.phase}
          title={toast.title}
          variant={toast.variant}
        />
      ) : null}
    </div>
  );
}
