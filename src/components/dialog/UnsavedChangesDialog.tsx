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
    <div role="presentation">
      <div
        aria-labelledby="unsaved-dialog-title"
        aria-modal="true"
        role="dialog"
      >
        <h2 id="unsaved-dialog-title">
          {title}
        </h2>
        <p>
          <strong>{filename}</strong> {description}
        </p>
        <div>
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
