import { createContext, use, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Toast } from "../ui/Toast";
import { useToastState } from "../../hooks/useToastState";

type ShowToast = ReturnType<typeof useToastState>["showToast"];

type ToastContextValue = {
  showToast: ShowToast;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function ToastViewport({
  handleExitComplete,
  toast,
}: Pick<ReturnType<typeof useToastState>, "handleExitComplete" | "toast">) {
  if (typeof document === "undefined" || !toast) {
    return null;
  }

  return createPortal(
    <Toast
      key={toast.id}
      message={toast.message}
      onExitComplete={() => handleExitComplete(toast.id)}
      phase={toast.phase}
      title={toast.title}
      variant={toast.variant}
    />,
    document.body,
  );
}

export function ToastProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { handleExitComplete, showToast, toast } = useToastState();

  return (
    <ToastContext value={{ showToast }}>
      {children}
      <ToastViewport
        handleExitComplete={handleExitComplete}
        toast={toast}
      />
    </ToastContext>
  );
}

export function useToast() {
  const context = use(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider.");
  }

  return context;
}
