import { useEffectEvent } from "react";
import type { OpenedDocument, SavedDocument } from "../lib/file-system";
import {
  registerWindowDocumentPath,
  registerWindowUntitledDocument,
  registerWindowWelcome,
} from "../lib/document-window";
import { logDebug } from "../lib/debug-log";

type WorkspaceDocument = OpenedDocument | {
  filename: string;
  markdown: string;
  path: string | null;
};

type UseDocumentSessionFileEffectsOptions = {
  applySavedDocumentToWorkspace: (document: SavedDocument) => void;
  applyWorkspaceDocument: (document: WorkspaceDocument) => void;
  forgetRecentFile: (path: string) => void;
  onError: (message: string) => void;
  onInfo: (message: string) => void;
  rememberRecentFile: (path: string | null) => void;
};

function registerWindowDocumentPathQuietly(path: string | null) {
  void registerWindowDocumentPath(path).catch((error) => {
    logDebug(
      `window:registerDocumentPath failed path=${path ?? "null"} error=${String(error)}`,
    );
  });
}

function registerWindowUntitledDocumentQuietly() {
  void registerWindowUntitledDocument().catch((error) => {
    logDebug(`window:registerUntitledDocument failed error=${String(error)}`);
  });
}

function registerWindowWelcomeQuietly() {
  void registerWindowWelcome().catch((error) => {
    logDebug(`window:registerWelcome failed error=${String(error)}`);
  });
}

export function useDocumentSessionFileEffects({
  applySavedDocumentToWorkspace,
  applyWorkspaceDocument,
  forgetRecentFile,
  onError,
  onInfo,
  rememberRecentFile,
}: UseDocumentSessionFileEffectsOptions) {
  const applyOpenedDocument = useEffectEvent((document: WorkspaceDocument) => {
    applyWorkspaceDocument(document);
    rememberRecentFile(document.path);
    registerWindowDocumentPathQuietly(document.path);
  });

  const applySavedDocument = useEffectEvent((saved: SavedDocument) => {
    applySavedDocumentToWorkspace(saved);
    rememberRecentFile(saved.path);
    registerWindowDocumentPathQuietly(saved.path);
  });

  const registerCurrentWindowAsUntitledDocument = useEffectEvent(() => {
    registerWindowUntitledDocumentQuietly();
  });

  const registerCurrentWindowAsWelcome = useEffectEvent(() => {
    registerWindowWelcomeQuietly();
  });

  const handleMissingRecentFile = useEffectEvent((path: string) => {
    forgetRecentFile(path);
    onError("This recent file could not be found and was removed from the list.");
  });

  const handleUnavailableRecentFile = useEffectEvent(() => {
    onInfo("Recent files are only available in the desktop app.");
  });

  return {
    applyOpenedDocument,
    applySavedDocument,
    handleMissingRecentFile,
    handleUnavailableRecentFile,
    registerCurrentWindowAsUntitledDocument,
    registerCurrentWindowAsWelcome,
  };
}
