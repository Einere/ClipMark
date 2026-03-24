type ToastProps = {
  message: string;
  tone?: "error" | "info";
};

export function Toast({ message, tone = "info" }: ToastProps) {
  return (
    <div
      aria-live="polite"
      data-tone={tone}
      role="status"
    >
      {message}
    </div>
  );
}
