import { useEffectEvent, useState } from "react";
import type { PendingAction } from "../lib/pending-action";

type UsePendingDocumentActionOptions = {
  activeFilename: string;
  hideWindowAndResetDocument: () => Promise<void>;
  saveDocument: (options: {
    activeFilename: string;
    saveAs?: boolean;
  }) => Promise<boolean>;
};

export function usePendingDocumentAction({
  activeFilename,
  hideWindowAndResetDocument,
  saveDocument,
}: UsePendingDocumentActionOptions) {
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const performAction = useEffectEvent(async (_action: PendingAction) => {
    await hideWindowAndResetDocument();
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
    resolvePendingActionWithDiscard,
    resolvePendingActionWithSave,
  };
}
