import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { Button } from "./Button";

function createTestRenderer() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  return {
    container,
    root,
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

const cleanupHandlers: Array<() => void> = [];

afterEach(() => {
  while (cleanupHandlers.length > 0) {
    cleanupHandlers.pop()?.();
  }
});

describe("Button", () => {
  it("uses the secondary variant by default", () => {
    const renderer = createTestRenderer();
    cleanupHandlers.push(() => renderer.cleanup());

    renderer.render(<Button>Open</Button>);

    const button = renderer.container.querySelector("button");
    expect(button?.dataset.variant).toBe("secondary");
    expect(button?.className).toContain("ui-button");
  });

  it("exposes the requested variant and preserves caller classes", () => {
    const renderer = createTestRenderer();
    cleanupHandlers.push(() => renderer.cleanup());

    renderer.render(
      <Button className="extra-class" variant="primary">
        Save
      </Button>,
    );

    const button = renderer.container.querySelector("button");
    expect(button?.dataset.variant).toBe("primary");
    expect(button?.className).toContain("extra-class");
  });
});
