export type ToastVariant = "error" | "info" | "success" | "warning";

type ToastProps = {
  message: string;
  title?: string;
  variant?: ToastVariant;
};

const TOAST_META: Record<ToastVariant, {
  icon: string;
  label: string;
  live: "assertive" | "polite";
  role: "alert" | "status";
}> = {
  error: {
    icon: "!",
    label: "Error",
    live: "assertive",
    role: "alert",
  },
  info: {
    icon: "i",
    label: "Note",
    live: "polite",
    role: "status",
  },
  success: {
    icon: "OK",
    label: "Done",
    live: "polite",
    role: "status",
  },
  warning: {
    icon: "!",
    label: "Warning",
    live: "polite",
    role: "status",
  },
};

export function Toast({
  message,
  title,
  variant = "info",
}: ToastProps) {
  const meta = TOAST_META[variant];

  return (
    <div
      aria-atomic="true"
      aria-live={meta.live}
      className="ui-toast"
      data-variant={variant}
      role={meta.role}
    >
      <div aria-hidden="true" className="ui-toast__icon">
        {meta.icon}
      </div>
      <div className="ui-toast__content">
        <p className="ui-toast__title">{title ?? meta.label}</p>
        <p className="ui-toast__message">{message}</p>
      </div>
    </div>
  );
}
