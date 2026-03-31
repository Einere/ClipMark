import { flushSync } from "react-dom";
import { useEffectEvent, useState } from "react";
import {
  getPostDiscardResolution,
  getPostSaveResolution,
  type PendingAction,
} from "../lib/pending-action";

type OpenedDocumentLike = {
  filename: string;
  markdown: string;
  path: string | null;
};

type UsePendingDocumentActionOptions = {
  activeFilename: string;
  applyOpenedDocument: (document: OpenedDocumentLike) => void;
  createNewDocument: () => void;
  ensureWindowVisible: () => Promise<void>;
  hideWindowAndResetDocument: () => Promise<void>;
  isDirty: boolean;
  isWindowVisible: boolean;
  loadRecentDocument: (path: string) => Promise<OpenedDocumentLike | null>;
  onWindowVisibleChange: (isVisible: boolean) => void;
  openWithPicker: () => Promise<OpenedDocumentLike | null>;
  openWithPickerWithoutShowingWindow: () => Promise<OpenedDocumentLike | null>;
  saveDocument: (options: {
    activeFilename: string;
    saveAs?: boolean;
  }) => Promise<boolean>;
};

export function usePendingDocumentAction({
  activeFilename,
  applyOpenedDocument,
  createNewDocument,
  ensureWindowVisible,
  hideWindowAndResetDocument,
  isDirty,
  isWindowVisible,
  loadRecentDocument,
  onWindowVisibleChange,
  openWithPicker,
  openWithPickerWithoutShowingWindow,
  saveDocument,
}: UsePendingDocumentActionOptions) {
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const performAction = useEffectEvent(async (action: PendingAction) => {
    if (action.type === "closeWindow") {
      await hideWindowAndResetDocument();
      return;
    }

    if (action.type === "new") {
      createNewDocument();
      return;
    }

    if (action.type === "open") {
      await openWithPicker();
      return;
    }

    const document = await loadRecentDocument(action.path);
    if (!document) {
      return;
    }

    applyOpenedDocument(document);
  });

  const requestAction = useEffectEvent((action: PendingAction) => {
    if (isDirty) {
      setPendingAction(action);
      return;
    }

    void performAction(action);
  });

  const showHiddenWindowWithDocument = useEffectEvent((
    loadDocument: () => Promise<OpenedDocumentLike | null>,
  ) => {
    void loadDocument().then((document) => {
      if (!document) {
        return;
      }

      flushSync(() => {
        applyOpenedDocument(document);
        onWindowVisibleChange(true);
      });
      void ensureWindowVisible();
    });
  });

  const requestVisibleAction = useEffectEvent((action: PendingAction) => {
    if (isWindowVisible) {
      requestAction(action);
      return;
    }

    if (action.type === "new") {
      flushSync(() => {
        createNewDocument();
        onWindowVisibleChange(true);
      });
      void ensureWindowVisible();
      return;
    }

    if (action.type === "open") {
      showHiddenWindowWithDocument(() => openWithPickerWithoutShowingWindow());
      return;
    }

    if (action.type === "openRecent") {
      showHiddenWindowWithDocument(() => loadRecentDocument(action.path));
      return;
    }

    void ensureWindowVisible().then(() => {
      onWindowVisibleChange(true);
    });
  });

  const resolvePendingActionWithSave = useEffectEvent(async () => {
    const action = pendingAction;
    if (!action) {
      return;
    }

    const saved = await saveDocument({ activeFilename });
    if (!saved) {
      return;
    }

    setPendingAction(null);
    if (getPostSaveResolution(action) === "hide-window") {
      await hideWindowAndResetDocument();
      return;
    }

    await performAction(action);
  });

  const resolvePendingActionWithDiscard = useEffectEvent(async () => {
    const action = pendingAction;
    setPendingAction(null);

    if (!action || getPostDiscardResolution(action) === "cancel") {
      return;
    }

    await performAction(action);
  });

  return {
    pendingAction,
    queuePendingAction: setPendingAction,
    requestAction,
    requestVisibleAction,
    resolvePendingActionWithDiscard,
    resolvePendingActionWithSave,
  };
}
