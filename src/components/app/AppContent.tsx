import { lazy } from "react";
import type { ChangeEventHandler, RefObject } from "react";
import { UnsavedChangesDialog } from "../dialog/UnsavedChangesDialog";
import type { MarkdownEditorHandle } from "../editor/MarkdownEditor";
import { WelcomeScreen } from "../welcome/WelcomeScreen";
import { EditorWorkspaceContainer } from "./EditorWorkspaceContainer";
import type { DocumentStore } from "../../lib/document-store";
import type { RecentFile } from "../../lib/recent-files";
import type { DocumentStatus } from "../../lib/window-state";

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
    setPreviewPanelWidth: (width: number | null) => void;
    setTocPanelWidth: (width: number | null) => void;
  };
  fileInput: {
    onChange: ChangeEventHandler<HTMLInputElement>;
    ref: RefObject<HTMLInputElement | null>;
  };
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
        <EditorWorkspaceContainer
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
          setPreviewPanelWidth={editor.setPreviewPanelWidth}
          setTocPanelWidth={editor.setTocPanelWidth}
        />
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
    </div>
  );
}
