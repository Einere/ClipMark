import type { DocumentMetrics } from "../../lib/document-metrics";
import { useToast } from "../toast/ToastProvider";
import { useCopyFilePath } from "../../hooks/useCopyFilePath";
import type { DocumentStatus } from "../../lib/window-state";

type DocumentWorkspaceFooterProps = {
  documentStatus: DocumentStatus | null;
  filePath: string | null;
  headingCount: number;
  metrics: DocumentMetrics;
};

type VisibleDocumentStatus = {
  dataStatus: "edited" | "initial" | "saved";
  label: "Draft" | "Saved" | "Unsaved";
};

function getVisibleDocumentStatus(documentStatus: DocumentStatus | null): VisibleDocumentStatus {
  if (documentStatus === "edited") {
    return {
      dataStatus: "edited",
      label: "Unsaved",
    };
  }

  if (documentStatus === "saved") {
    return {
      dataStatus: "saved",
      label: "Saved",
    };
  }

  return {
    dataStatus: "initial",
    label: "Draft",
  };
}

function getFileLabel(filePath: string | null) {
  if (!filePath) {
    return "Unsaved local document";
  }

  const segments = filePath.split(/[\\/]/);
  return segments.at(-1) ?? filePath;
}

function DocumentFooterFile({
  filePath,
  onPathCopy,
}: {
  filePath: string | null;
  onPathCopy: () => void;
}) {
  return (
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
  );
}

function DocumentFooterStatus({
  documentStatus,
}: Pick<DocumentWorkspaceFooterProps, "documentStatus">) {
  const visibleStatus = getVisibleDocumentStatus(documentStatus);

  return (
    <span className="editor-workspace__status" data-status={visibleStatus.dataStatus}>
      {visibleStatus.label}
    </span>
  );
}

function DocumentFooterMeta({
  documentStatus,
  headingCount,
  metrics,
}: Pick<DocumentWorkspaceFooterProps, "documentStatus" | "headingCount" | "metrics">) {
  const items = [
    {
      key: "status",
      content: <DocumentFooterStatus documentStatus={documentStatus} />,
    },
    {
      key: "words",
      content: `${metrics.wordCount} words`,
    },
    {
      key: "lines",
      content: `${metrics.lineCount} lines`,
    },
    {
      key: "headings",
      content: `${headingCount} headings`,
    },
  ];

  return (
    <div className="editor-workspace__footer-meta" aria-label="Document summary">
      {items.map((item) => (
        <span key={item.key}>{item.content}</span>
      ))}
    </div>
  );
}

export function DocumentWorkspaceFooter({
  documentStatus,
  filePath,
  headingCount,
  metrics,
}: DocumentWorkspaceFooterProps) {
  const { showToast } = useToast();
  const { copyFilePath } = useCopyFilePath({
    filePath,
    successToastVariant: "success",
    showToast,
  });

  return (
    <footer className="editor-workspace__footer">
      <DocumentFooterFile filePath={filePath} onPathCopy={copyFilePath} />
      <DocumentFooterMeta
        documentStatus={documentStatus}
        headingCount={headingCount}
        metrics={metrics}
      />
    </footer>
  );
}
