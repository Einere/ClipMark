import type { ChangeEvent } from "react";
import { useEffectEvent, useRef } from "react";
import type { OpenedDocument, SavedDocument } from "../lib/file-system";
import {
  openMarkdownDocument,
  openMarkdownDocumentWithoutShowingWindow,
  saveMarkdownDocument,
} from "../lib/file-system";
import { openRecentFile } from "../lib/recent-files";

type UseDocumentFileActionsOptions = {
  activeFilePath: string | null;
  applyOpenedDocument: (document: OpenedDocument | {
    filename: string;
    markdown: string;
    path: string | null;
  }) => void;
  applySavedDocument: (document: SavedDocument) => void;
  createNewDocument: () => void;
  getMarkdown: () => string;
  isWelcomeVisible: boolean;
  onMissingRecentFile: (path: string) => void;
  onRecentFileUnavailable: () => void;
};

export function useDocumentFileActions({
  activeFilePath,
  applyOpenedDocument,
  applySavedDocument,
  createNewDocument,
  getMarkdown,
  isWelcomeVisible,
  onMissingRecentFile,
  onRecentFileUnavailable,
}: UseDocumentFileActionsOptions) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openWithPicker = useEffectEvent(async (fallbackToFileInput = true) => {
    const document = await openMarkdownDocument();
    if (!document) {
      if (fallbackToFileInput) {
        fileInputRef.current?.click();
      }
      return null;
    }

    applyOpenedDocument(document);
    return document;
  });

  const openWithPickerWithoutShowingWindow = useEffectEvent(async () => {
    return openMarkdownDocumentWithoutShowingWindow();
  });

  const loadRecentDocument = useEffectEvent(async (path: string) => {
    try {
      const document = await openRecentFile(path);
      if (!document) {
        onRecentFileUnavailable();
        return null;
      }

      return document;
    } catch {
      onMissingRecentFile(path);
      return null;
    }
  });

  const saveDocument = useEffectEvent(async ({
    activeFilename,
    saveAs = false,
  }: {
    activeFilename: string;
    saveAs?: boolean;
  }) => {
    if (isWelcomeVisible) {
      createNewDocument();
    }

    const saved = await saveMarkdownDocument({
      filename: activeFilename,
      markdown: getMarkdown(),
      path: activeFilePath,
      saveAs,
    });

    if (!saved) {
      return false;
    }

    applySavedDocument(saved);
    return true;
  });

  const handleOpenFile = useEffectEvent(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    applyOpenedDocument({
      filename: file.name,
      markdown: text,
      path: null,
    });
    event.target.value = "";
  });

  return {
    fileInputRef,
    handleOpenFile,
    loadRecentDocument,
    openWithPicker,
    openWithPickerWithoutShowingWindow,
    saveDocument,
  };
}
