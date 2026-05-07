import type { PendingAction } from "./pending-action";

export function getUnsavedDialogState(
  activeFilename: string,
  pendingAction: PendingAction | null,
) {
  if (pendingAction?.type === "closeWindow") {
    return {
      confirmLabel: "Close Without Saving",
      description: `${activeFilename} has unsaved changes. Save first or close this window without keeping the latest edits.`,
      title: "Save changes before closing?",
    };
  }

  return {
    confirmLabel: "Continue Editing",
    description: `${activeFilename} has unsaved changes. Save first, or keep editing without changing the current document.`,
    title: "Save changes before continuing?",
  };
}
