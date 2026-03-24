import { Button } from "../ui";

type UnsavedChangesDialogProps = {
  confirmLabel: string;
  description: string;
  filename: string;
  onDiscard: () => void;
  onSave: () => void;
  open: boolean;
  title: string;
};

export function UnsavedChangesDialog({
  confirmLabel,
  description,
  filename,
  onDiscard,
  onSave,
  open,
  title,
}: UnsavedChangesDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <div
        aria-labelledby="unsaved-dialog-title"
        aria-modal="true"
        className="dialog-panel"
        role="dialog"
      >
        <h2 className="dialog-title" id="unsaved-dialog-title">
          {title}
        </h2>
        <p className="dialog-description">
          <strong>{filename}</strong> {description}
        </p>
        <div className="dialog-actions">
          <Button onClick={onDiscard} variant="secondary">
            {confirmLabel}
          </Button>
          <Button onClick={onSave} variant="primary">
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
