import { getToastClasses } from "../../lib/design-system";

type ToastProps = {
  message: string;
  tone?: "error" | "info";
};

export function Toast({ message, tone = "info" }: ToastProps) {
  return (
    <div
      aria-live="polite"
      className={getToastClasses(tone)}
      role="status"
    >
      {message}
    </div>
  );
}
