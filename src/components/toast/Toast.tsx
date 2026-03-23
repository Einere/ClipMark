type ToastProps = {
  message: string;
  tone?: "error" | "info";
};

export function Toast({ message, tone = "info" }: ToastProps) {
  return (
    <div
      aria-live="polite"
      className={`toast toast--${tone}`}
      role="status"
    >
      {message}
    </div>
  );
}
