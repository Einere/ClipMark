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
        className="dialog-card"
        role="dialog"
      >
        <h2 className="dialog-card__title" id="unsaved-dialog-title">
          {title}
        </h2>
        <p className="dialog-card__body">
          <strong>{filename}</strong> {description}
        </p>
        <div className="dialog-card__actions">
          <button className="button-secondary" onClick={onDiscard} type="button">
            {confirmLabel}
          </button>
          <button className="button-primary" onClick={onSave} type="button">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
