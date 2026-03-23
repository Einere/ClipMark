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
