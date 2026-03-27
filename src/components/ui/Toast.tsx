import type { AnimationEventHandler } from "react";

export type ToastVariant = "error" | "info" | "success" | "warning";
export type ToastPhase = "enter" | "exit";

type ToastProps = {
  message: string;
  onExitComplete?: () => void;
  phase?: ToastPhase;
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
  onExitComplete,
  phase = "enter",
  title,
  variant = "info",
}: ToastProps) {
  const meta = TOAST_META[variant];
  const handleAnimationEnd: AnimationEventHandler<HTMLDivElement> = (event) => {
    if (
      phase === "exit"
      && event.target === event.currentTarget
      && event.animationName === "ui-toast-exit"
    ) {
      onExitComplete?.();
    }
  };

  return (
    <div
      aria-atomic="true"
      aria-live={meta.live}
      className="ui-toast"
      data-phase={phase}
      data-variant={variant}
      onAnimationEnd={handleAnimationEnd}
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
