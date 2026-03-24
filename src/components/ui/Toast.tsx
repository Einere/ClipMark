import { cn } from "../../lib/cn";

type ToastProps = {
  message: string;
  tone?: "error" | "info";
};

export function Toast({ message, tone = "info" }: ToastProps) {
  return (
    <div
      aria-live="polite"
      className={cn("cm-toast", tone === "error" ? "cm-toast-error" : "cm-toast-info")}
      role="status"
    >
      {message}
    </div>
  );
}
