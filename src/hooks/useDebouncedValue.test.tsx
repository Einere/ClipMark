import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedValue } from "./useDebouncedValue";

function Harness({
  delayMs,
  onValue,
  value,
}: {
  delayMs: number;
  onValue: (value: string) => void;
  value: string;
}) {
  const debouncedValue = useDebouncedValue(value, delayMs);
  onValue(debouncedValue);
  return null;
}

describe("useDebouncedValue", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let onValue: ReturnType<typeof vi.fn<(value: string) => void>>;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onValue = vi.fn();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  it("updates after the configured delay", () => {
    act(() => {
      root.render(createElement(Harness, {
        delayMs: 120,
        onValue,
        value: "first",
      }));
    });

    act(() => {
      root.render(createElement(Harness, {
        delayMs: 120,
        onValue,
        value: "second",
      }));
    });

    expect(onValue).toHaveBeenLastCalledWith("first");

    act(() => {
      vi.advanceTimersByTime(119);
    });

    expect(onValue).toHaveBeenLastCalledWith("first");

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(onValue).toHaveBeenLastCalledWith("second");
  });

  it("cancels an older update when a newer value arrives first", () => {
    act(() => {
      root.render(createElement(Harness, {
        delayMs: 120,
        onValue,
        value: "first",
      }));
    });

    act(() => {
      root.render(createElement(Harness, {
        delayMs: 120,
        onValue,
        value: "second",
      }));
    });

    act(() => {
      vi.advanceTimersByTime(60);
      root.render(createElement(Harness, {
        delayMs: 120,
        onValue,
        value: "third",
      }));
    });

    act(() => {
      vi.advanceTimersByTime(60);
    });

    expect(onValue).toHaveBeenLastCalledWith("first");

    act(() => {
      vi.advanceTimersByTime(60);
    });

    expect(onValue).toHaveBeenLastCalledWith("third");
  });
});
