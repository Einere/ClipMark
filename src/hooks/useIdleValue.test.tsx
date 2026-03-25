import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIdleValue } from "./useIdleValue";

function Harness({
  onValue,
  timeoutMs,
  value,
}: {
  onValue: (value: string) => void;
  timeoutMs?: number;
  value: string;
}) {
  const idleValue = useIdleValue(value, { timeoutMs });
  onValue(idleValue);
  return null;
}

describe("useIdleValue", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let onValue: ReturnType<typeof vi.fn<(value: string) => void>>;
  let originalRequestIdleCallback: typeof window.requestIdleCallback | undefined;
  let originalCancelIdleCallback: typeof window.cancelIdleCallback | undefined;
  let idleWindow: Window & {
    cancelIdleCallback?: typeof window.cancelIdleCallback;
    requestIdleCallback?: typeof window.requestIdleCallback;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onValue = vi.fn();
    idleWindow = window as typeof idleWindow;
    originalRequestIdleCallback = window.requestIdleCallback;
    originalCancelIdleCallback = window.cancelIdleCallback;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();

    if (originalRequestIdleCallback) {
      window.requestIdleCallback = originalRequestIdleCallback;
    } else {
      Reflect.deleteProperty(idleWindow, "requestIdleCallback");
    }

    if (originalCancelIdleCallback) {
      window.cancelIdleCallback = originalCancelIdleCallback;
    } else {
      Reflect.deleteProperty(idleWindow, "cancelIdleCallback");
    }

    vi.useRealTimers();
  });

  it("updates when the idle callback fires", () => {
    window.requestIdleCallback = vi.fn((callback: IdleRequestCallback) => {
      return window.setTimeout(() => {
        callback({
          didTimeout: false,
          timeRemaining: () => 12,
        } as IdleDeadline);
      }, 40);
    });
    window.cancelIdleCallback = vi.fn((handle: number) => {
      window.clearTimeout(handle);
    });

    act(() => {
      root.render(createElement(Harness, {
        onValue,
        timeoutMs: 200,
        value: "first",
      }));
    });

    act(() => {
      root.render(createElement(Harness, {
        onValue,
        timeoutMs: 200,
        value: "second",
      }));
    });

    expect(onValue).toHaveBeenLastCalledWith("first");

    act(() => {
      vi.advanceTimersByTime(39);
    });

    expect(onValue).toHaveBeenLastCalledWith("first");

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(onValue).toHaveBeenLastCalledWith("second");
  });

  it("falls back to a short timeout when requestIdleCallback is unavailable", () => {
    Reflect.deleteProperty(idleWindow, "requestIdleCallback");
    Reflect.deleteProperty(idleWindow, "cancelIdleCallback");

    act(() => {
      root.render(createElement(Harness, {
        onValue,
        value: "first",
      }));
    });

    act(() => {
      root.render(createElement(Harness, {
        onValue,
        value: "second",
      }));
    });

    expect(onValue).toHaveBeenLastCalledWith("first");

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(onValue).toHaveBeenLastCalledWith("second");
  });
});
