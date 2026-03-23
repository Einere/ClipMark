type UnsavedChangesDialogProps = {
  filename: string;
  onDiscard: () => void;
  onSave: () => void;
  open: boolean;
};

export function UnsavedChangesDialog({
  filename,
  onDiscard,
  onSave,
  open,
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
          Save changes before continuing?
        </h2>
        <p className="dialog-card__body">
          <strong>{filename}</strong> has unsaved changes. Save first, or keep
          editing without changing the current document.
        </p>
        <div className="dialog-card__actions">
          <button className="button-secondary" onClick={onDiscard} type="button">
            Continue Editing
          </button>
          <button className="button-primary" onClick={onSave} type="button">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
