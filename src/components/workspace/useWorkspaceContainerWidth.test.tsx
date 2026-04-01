import { createRef, type ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceContainerWidth } from "./useWorkspaceContainerWidth";

function createTestRenderer() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  return {
    cleanup() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
    render(element: ReactNode) {
      act(() => {
        root.render(element);
      });
    },
  };
}

function Harness({
  containerRef,
  onReady,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  onReady: (width: number | null) => void;
}) {
  const width = useWorkspaceContainerWidth(containerRef);
  onReady(width);
  return null;
}

describe("useWorkspaceContainerWidth", () => {
  let renderer: ReturnType<typeof createTestRenderer>;

  beforeEach(() => {
    renderer = createTestRenderer();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    renderer.cleanup();
  });

  it("reads width and updates it from the resize fallback when ResizeObserver is unavailable", () => {
    const containerRef = createRef<HTMLElement>();
    const element = document.createElement("main");
    Object.defineProperty(element, "clientWidth", {
      configurable: true,
      value: 720,
    });
    containerRef.current = element;
    vi.stubGlobal("ResizeObserver", undefined);

    let latestWidth: number | null = null;

    renderer.render(
      <Harness
        containerRef={containerRef}
        onReady={(width) => {
          latestWidth = width;
        }}
      />,
    );

    expect(latestWidth).toBe(720);

    Object.defineProperty(element, "clientWidth", {
      configurable: true,
      value: 960,
    });

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(latestWidth).toBe(960);
  });
});
