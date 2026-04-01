import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useToastState } from "./useToastState";

type Controls = ReturnType<typeof useToastState>;

function Harness({
  onReady,
}: {
  onReady: (controls: Controls) => void;
}) {
  const controls = useToastState();
  onReady(controls);
  return null;
}

describe("useToastState", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let controls: Controls;

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

  it("shows a toast immediately and transitions it to exit after the variant duration", async () => {
    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
      }));
    });

    await act(async () => {
      controls.showToast("Saved.", "success");
    });

    expect(controls.toast?.phase).toBe("enter");
    expect(controls.toast?.variant).toBe("success");

    act(() => {
      vi.advanceTimersByTime(3200);
    });

    expect(controls.toast?.phase).toBe("exit");
  });

  it("removes the toast only after the matching exit completes", async () => {
    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
      }));
    });

    await act(async () => {
      controls.showToast("Failed.", "error");
    });

    const firstToastId = controls.toast?.id;

    act(() => {
      vi.advanceTimersByTime(5600);
    });

    expect(controls.toast?.phase).toBe("exit");

    await act(async () => {
      controls.showToast("Saved again.", "success");
    });

    await act(async () => {
      controls.handleExitComplete(firstToastId!);
    });

    expect(controls.toast?.message).toBe("Saved again.");
    expect(controls.toast?.phase).toBe("enter");

    await act(async () => {
      controls.handleExitComplete(controls.toast!.id);
    });

    expect(controls.toast?.message).toBe("Saved again.");
  });
});
