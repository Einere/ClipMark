export type DocumentStatus = "edited" | "initial" | "saved";

export function getDocumentStatus(
  filePath: string | null,
  isEdited: boolean,
  isWelcomeVisible: boolean,
): DocumentStatus {
  if (isWelcomeVisible || (filePath === null && !isEdited)) {
    return "initial";
  }

  return isEdited ? "edited" : "saved";
}

export function buildWindowTitle(
  filename: string,
  status: DocumentStatus,
): string {
  if (status === "initial") {
    return filename;
  }

  return `${filename} - ${status}`;
}

export function getVisibleDocumentStatus(status: DocumentStatus) {
  if (status === "initial") {
    return null;
  }

  return status;
}
