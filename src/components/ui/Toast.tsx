type ToastProps = {
  message: string;
  tone?: "error" | "info";
};

export function Toast({ message, tone = "info" }: ToastProps) {
  return (
    <div
      aria-live="polite"
      className="ui-toast"
      data-tone={tone}
      role="status"
    >
      {message}
    </div>
  );
}
