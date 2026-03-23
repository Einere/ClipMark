export type PendingAction =
  | { type: "closeWindow" }
  | { type: "new" }
  | { type: "open" }
  | { path: string; type: "openRecent" };

export function getPostSaveResolution(action: PendingAction) {
  if (action.type === "closeWindow") {
    return "hide-window" as const;
  }

  return "perform" as const;
}

export function getPostDiscardResolution(action: PendingAction) {
  if (action.type === "closeWindow") {
    return "hide-window" as const;
  }

  return "cancel" as const;
}
