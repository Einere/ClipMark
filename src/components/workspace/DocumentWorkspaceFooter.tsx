import { summarizeDocument } from "../../lib/document-metrics";
import type { DocumentStatus } from "../../lib/window-state";

function formatDocumentStatus(documentStatus: DocumentStatus | null) {
  if (documentStatus === "edited") {
    return "Unsaved";
  }

  if (documentStatus === "saved") {
    return "Saved";
  }

  return "Draft";
}

function getFileLabel(filePath: string | null) {
  if (!filePath) {
    return "Unsaved local document";
  }

  const segments = filePath.split(/[\\/]/);
  return segments.at(-1) ?? filePath;
}

export function DocumentWorkspaceFooter({
  documentStatus,
  filePath,
  headingCount,
  metrics,
  onPathCopy,
}: {
  documentStatus: DocumentStatus | null;
  filePath: string | null;
  headingCount: number;
  metrics: ReturnType<typeof summarizeDocument>;
  onPathCopy: () => void;
}) {
  const visibleStatusLabel = formatDocumentStatus(documentStatus);

  return (
    <footer className="editor-workspace__footer">
      <div className="editor-workspace__footer-primary">
        <span className="editor-workspace__footer-label">File</span>
        {filePath ? (
          <button
            className="editor-workspace__path-button"
            onClick={onPathCopy}
            title="Click to copy file path"
            type="button"
          >
            {filePath}
          </button>
        ) : (
          <span className="editor-workspace__footer-value">{getFileLabel(filePath)}</span>
        )}
      </div>
      <div className="editor-workspace__footer-meta" aria-label="Document summary">
        <span>{visibleStatusLabel}</span>
        <span>{metrics.wordCount} words</span>
        <span>{metrics.lineCount} lines</span>
        <span>{headingCount} headings</span>
      </div>
    </footer>
  );
}
