import { useEffect, useState } from "react";

type IdleValueOptions = {
  timeoutMs?: number;
};

type IdleCallbackHandle = number;
type IdleCallbackDeadline = {
  didTimeout: boolean;
  timeRemaining: () => number;
};

type IdleCallback = (deadline: IdleCallbackDeadline) => void;

type WindowWithIdleCallback = Window & typeof globalThis & {
  cancelIdleCallback?: (handle: IdleCallbackHandle) => void;
  requestIdleCallback?: (
    callback: IdleCallback,
    options?: { timeout: number },
  ) => IdleCallbackHandle;
};

const DEFAULT_IDLE_TIMEOUT_MS = 250;

export function useIdleValue<T>(
  value: T,
  options: IdleValueOptions = {},
) {
  const [idleValue, setIdleValue] = useState(value);
  const timeoutMs = options.timeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;

  useEffect(() => {
    const idleWindow = window as WindowWithIdleCallback;

    if (typeof idleWindow.requestIdleCallback === "function") {
      const handle = idleWindow.requestIdleCallback(() => {
        setIdleValue(value);
      }, { timeout: timeoutMs });

      return () => {
        idleWindow.cancelIdleCallback?.(handle);
      };
    }

    const timeoutId = window.setTimeout(() => {
      setIdleValue(value);
    }, 1);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [timeoutMs, value]);

  return idleValue;
}
