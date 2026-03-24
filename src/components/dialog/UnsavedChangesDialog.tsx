import {
  designSystem,
  getButtonClasses,
} from "../../lib/design-system";

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
    <div className={designSystem.dialogBackdrop} role="presentation">
      <div
        aria-labelledby="unsaved-dialog-title"
        aria-modal="true"
        className={designSystem.dialogCard}
        role="dialog"
      >
        <h2 className={designSystem.dialogTitle} id="unsaved-dialog-title">
          {title}
        </h2>
        <p className={designSystem.dialogBody}>
          <strong>{filename}</strong> {description}
        </p>
        <div className={designSystem.dialogActions}>
          <button className={getButtonClasses("secondary")} onClick={onDiscard} type="button">
            {confirmLabel}
          </button>
          <button className={getButtonClasses("primary")} onClick={onSave} type="button">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
