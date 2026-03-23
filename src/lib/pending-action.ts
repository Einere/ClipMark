export type PendingAction =
  | { type: "close" }
  | { type: "new" }
  | { type: "open" }
  | { path: string; type: "openRecent" };

export function getPostSaveResolution(action: PendingAction) {
  if (action.type === "close") {
    return "force-close" as const;
  }

  return "perform" as const;
}

export function getPostDiscardResolution(action: PendingAction) {
  if (action.type === "close") {
    return "cancel" as const;
  }

  return "perform" as const;
}
