import { useEffectEvent } from "react";
import { showNativeCloseSheet } from "../lib/native-close-sheet";
import type { PendingAction } from "../lib/pending-action";

type UseWindowCloseRequestOptions = {
  activeFilename: string;
  closeWindowSession: () => Promise<void>;
  isDirty: boolean;
  queuePendingAction: (action: PendingAction) => void;
  saveDocument: (options: { activeFilename: string }) => Promise<boolean>;
};

export function useWindowCloseRequest({
  activeFilename,
  closeWindowSession,
  isDirty,
  queuePendingAction,
  saveDocument,
}: UseWindowCloseRequestOptions) {
  return useEffectEvent(async () => {
    if (!isDirty) {
      await closeWindowSession();
      return;
    }

    const result = await showNativeCloseSheet(activeFilename);
    if (result === "save") {
      const saved = await saveDocument({ activeFilename });
      if (saved) {
        await closeWindowSession();
      }
      return;
    }

    if (result === "discard") {
      await closeWindowSession();
      return;
    }

    if (result === "unsupported") {
      queuePendingAction({ type: "closeWindow" });
    }
  });
}
