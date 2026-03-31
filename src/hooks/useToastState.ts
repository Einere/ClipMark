import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { ToastPhase, ToastVariant } from "../components/ui/Toast";

const TOAST_DURATION_MS = 3200;
const TOAST_WARNING_DURATION_MS = 4200;
const TOAST_ERROR_DURATION_MS = 5600;

type ToastState = {
  id: number;
  message: string;
  phase: ToastPhase;
  title?: string;
  variant: ToastVariant;
};

function getToastDuration(variant: ToastVariant) {
  switch (variant) {
    case "error":
      return TOAST_ERROR_DURATION_MS;
    case "warning":
      return TOAST_WARNING_DURATION_MS;
    default:
      return TOAST_DURATION_MS;
  }
}

function prefersReducedToastMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useToastState() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const toastIdRef = useRef(0);

  const clearToastTimers = useEffectEvent(() => {
    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
  });

  const beginToastExit = useEffectEvent(() => {
    if (prefersReducedToastMotion()) {
      setToast(null);
      return;
    }

    setToast((currentToast) => {
      if (!currentToast || currentToast.phase === "exit") {
        return currentToast;
      }

      return {
        ...currentToast,
        phase: "exit",
      };
    });
  });

  const showToast = useEffectEvent((
    message: string,
    variant: ToastVariant = "info",
    title?: string,
  ) => {
    clearToastTimers();
    toastIdRef.current += 1;

    setToast({
      id: toastIdRef.current,
      message,
      phase: "enter",
      title,
      variant,
    });

    toastTimeoutRef.current = window.setTimeout(() => {
      toastTimeoutRef.current = null;
      beginToastExit();
    }, getToastDuration(variant));
  });

  const handleExitComplete = useEffectEvent((toastId: number) => {
    setToast((currentToast) => (
      currentToast?.id === toastId && currentToast.phase === "exit"
        ? null
        : currentToast
    ));
  });

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  return {
    handleExitComplete,
    showToast,
    toast,
  };
}
