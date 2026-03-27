import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TocPanel } from "./TocPanel";

function createTestRenderer() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  return {
    container,
    cleanup() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
    render(element: React.ReactNode) {
      act(() => {
        root.render(element);
      });
    },
  };
}

const cleanupHandlers: Array<() => void> = [];

afterEach(() => {
  while (cleanupHandlers.length > 0) {
    cleanupHandlers.pop()?.();
  }
});

describe("TocPanel", () => {
  it("renders long heading labels with a tooltip title and click behavior", () => {
    const renderer = createTestRenderer();
    cleanupHandlers.push(() => renderer.cleanup());
    const onSelectHeading = vi.fn();
    const longHeading =
      "A very long heading label that should remain contained inside the toc item even when it wraps across multiple lines";

    renderer.render(
      <TocPanel
        activeHeadingLine={null}
        headings={[
          {
            depth: 2,
            id: "long-heading",
            line: 12,
            text: longHeading,
          },
        ]}
        onSelectHeading={onSelectHeading}
      />,
    );

    const button = renderer.container.querySelector(".toc-panel__item");
    const label = renderer.container.querySelector(".toc-panel__item-label");

    expect(button?.getAttribute("title")).toBe(longHeading);
    expect(label?.textContent).toBe(longHeading);

    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onSelectHeading).toHaveBeenCalledWith(12);
  });
});
