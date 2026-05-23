export type PendingAction = { type: "closeWindow" };

export function getPostSaveResolution(_action: PendingAction) {
  return "hide-window" as const;
}

export function getPostDiscardResolution(_action: PendingAction) {
  return "hide-window" as const;
}
