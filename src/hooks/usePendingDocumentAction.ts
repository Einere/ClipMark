import { useEffectEvent, useState } from "react";
import type { PendingAction } from "../lib/pending-action";

type UsePendingDocumentActionOptions = {
  activeFilename: string;
  hideWindowAndResetDocument: () => Promise<void>;
  isDirty: boolean;
  saveDocument: (options: {
    activeFilename: string;
    saveAs?: boolean;
  }) => Promise<boolean>;
};

export function usePendingDocumentAction({
  activeFilename,
  hideWindowAndResetDocument,
  isDirty,
  saveDocument,
}: UsePendingDocumentActionOptions) {
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const performAction = useEffectEvent(async (_action: PendingAction) => {
    await hideWindowAndResetDocument();
  });

  const requestAction = useEffectEvent((action: PendingAction) => {
    if (isDirty) {
      setPendingAction(action);
      return;
    }

    void performAction(action);
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
    await performAction(action);
  });

  const resolvePendingActionWithDiscard = useEffectEvent(async () => {
    const action = pendingAction;
    setPendingAction(null);

    if (!action) {
      return;
    }

    await performAction(action);
  });

  return {
    pendingAction,
    queuePendingAction: setPendingAction,
    requestAction,
    resolvePendingActionWithDiscard,
    resolvePendingActionWithSave,
  };
}
