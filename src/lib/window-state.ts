export function buildWindowTitle(
  filename: string | null,
  isEdited: boolean,
  isWelcomeVisible: boolean,
): string {
  if (isWelcomeVisible || !filename) {
    return "ClipMark";
  }

  return `${filename} - ${isEdited ? "edited" : "saved"}`;
}

export function shouldDeferNativeWindowSync(
  isEditorFocused: boolean,
  isEdited: boolean,
): boolean {
  return isEditorFocused && isEdited;
}
