import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "./ToastProvider";

function Trigger() {
  const { showToast } = useToast();

  return (
    <button
      onClick={() => showToast("Saved.", "success")}
      type="button"
    >
      Show toast
    </button>
  );
}

describe("ToastProvider", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("renders toasts into document.body via a portal", async () => {
    await act(async () => {
      root.render(
        createElement(ToastProvider, {
          children: createElement(Trigger),
        }),
      );
    });

    const triggerButton = container.querySelector("button");
    expect(triggerButton?.textContent).toContain("Show toast");

    act(() => {
      (triggerButton as HTMLButtonElement).click();
    });

    const toast = document.body.querySelector("[role='status']");
    expect(toast).not.toBeNull();
    expect(toast?.getAttribute("data-variant")).toBe("success");
  });

  it("removes the portal toast after the exit animation completes", async () => {
    await act(async () => {
      root.render(
        createElement(ToastProvider, {
          children: createElement(Trigger),
        }),
      );
    });

    act(() => {
      (container.querySelector("button") as HTMLButtonElement).click();
    });

    act(() => {
      vi.advanceTimersByTime(3200);
    });

    const toast = document.body.querySelector("[role='status']");
    expect(toast?.getAttribute("data-phase")).toBe("exit");

    act(() => {
      const animationEndEvent = new Event("animationend", { bubbles: true });
      Object.defineProperty(animationEndEvent, "animationName", {
        value: "ui-toast-exit",
      });
      toast?.dispatchEvent(animationEndEvent);
    });

    expect(document.body.querySelector("[role='status']")).toBeNull();
  });
});
