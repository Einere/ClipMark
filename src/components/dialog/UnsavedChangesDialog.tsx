import { Button } from "../ui/Button";

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
    <div className="cm-dialog-backdrop" role="presentation">
      <div
        aria-labelledby="unsaved-dialog-title"
        aria-modal="true"
        className="cm-dialog-card"
        role="dialog"
      >
        <h2 className="cm-dialog-title" id="unsaved-dialog-title">
          {title}
        </h2>
        <p className="cm-dialog-body">
          <strong>{filename}</strong> {description}
        </p>
        <div className="cm-dialog-actions">
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
