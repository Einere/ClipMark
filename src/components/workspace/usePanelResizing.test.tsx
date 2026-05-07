import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePanelResizing } from "./usePanelResizing";

type Controls = ReturnType<typeof usePanelResizing>;

function Harness({
  onReady,
  onPanelWidthsChange,
}: {
  onReady: (controls: Controls) => void;
  onPanelWidthsChange: (widths: {
    previewPanelWidth: number | null;
    tocPanelWidth: number | null;
  }) => void;
}) {
  const controls = usePanelResizing({
    containerWidth: 1400,
    hasPreview: true,
    hasToc: true,
    initialPreviewPanelWidth: 480,
    initialTocPanelWidth: 260,
    onPanelWidthsChange,
  });

  onReady(controls);
  return null;
}

describe("usePanelResizing", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let controls: Controls;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("commits keyboard resizing for the toc panel", async () => {
    const onPanelWidthsChange = vi.fn();

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        onPanelWidthsChange,
      }));
    });

    act(() => {
      controls.resizeWithKeyboard("toc", {
        key: "ArrowRight",
        preventDefault: vi.fn(),
        shiftKey: false,
      } as unknown as React.KeyboardEvent<HTMLDivElement>);
    });

    expect(onPanelWidthsChange).toHaveBeenCalledWith({
      previewPanelWidth: 480,
      tocPanelWidth: 276,
    });
  });

  it("commits pointer resizing after pointerup", async () => {
    const onPanelWidthsChange = vi.fn();

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        onPanelWidthsChange,
      }));
    });

    const pointerMoveEvent = new Event("pointermove");
    Object.defineProperties(pointerMoveEvent, {
      clientX: { value: 132 },
      pointerId: { value: 7 },
    });
    const pointerUpEvent = new Event("pointerup");
    Object.defineProperties(pointerUpEvent, {
      clientX: { value: 132 },
      pointerId: { value: 7 },
    });

    act(() => {
      controls.startResize("toc", {
        clientX: 100,
        pointerId: 7,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>);
    });

    act(() => {
      window.dispatchEvent(pointerMoveEvent);
    });

    act(() => {
      window.dispatchEvent(pointerUpEvent);
    });

    expect(onPanelWidthsChange).toHaveBeenCalledWith({
      previewPanelWidth: 480,
      tocPanelWidth: 292,
    });
    expect(controls.isResizingPanels).toBe(false);
  });
});
