import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePanelPresence } from "./usePanelPresence";

type Controls = ReturnType<typeof usePanelPresence>;

function Harness({
  isVisible,
  onReady,
}: {
  isVisible: boolean;
  onReady: (controls: Controls) => void;
}) {
  const controls = usePanelPresence(isVisible);
  onReady(controls);
  return null;
}

describe("usePanelPresence", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let controls: Controls;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      return window.setTimeout(() => callback(performance.now()), 16);
    });
    vi.stubGlobal("cancelAnimationFrame", (handle: number) => {
      window.clearTimeout(handle);
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("moves from entering to open when a panel becomes visible", async () => {
    await act(async () => {
      root.render(createElement(Harness, {
        isVisible: false,
        onReady: (nextControls) => {
          controls = nextControls;
        },
      }));
    });

    await act(async () => {
      root.render(createElement(Harness, {
        isVisible: true,
        onReady: (nextControls) => {
          controls = nextControls;
        },
      }));
    });

    expect(controls.state).toBe("entering");
    expect(controls.isMounted).toBe(true);

    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(controls.state).toBe("open");
  });

  it("keeps the panel mounted during closing and then unmounts it", async () => {
    await act(async () => {
      root.render(createElement(Harness, {
        isVisible: true,
        onReady: (nextControls) => {
          controls = nextControls;
        },
      }));
    });

    await act(async () => {
      root.render(createElement(Harness, {
        isVisible: false,
        onReady: (nextControls) => {
          controls = nextControls;
        },
      }));
    });

    expect(controls.state).toBe("closing");
    expect(controls.isMounted).toBe(true);

    act(() => {
      vi.advanceTimersByTime(220);
    });

    expect(controls.state).toBe("closed");
    expect(controls.isMounted).toBe(false);
  });
});
