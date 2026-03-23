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
          Save changes before closing?
        </h2>
        <p className="dialog-card__body">
          <strong>{filename}</strong> has unsaved changes. You can save before
          continuing or discard the changes.
        </p>
        <div className="dialog-card__actions">
          <button className="button-secondary" onClick={onDiscard} type="button">
            Don&apos;t Save
          </button>
          <button className="button-primary" onClick={onSave} type="button">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
