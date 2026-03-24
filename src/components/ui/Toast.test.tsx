import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { Toast } from "./Toast";

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

describe("Toast", () => {
  it("renders as an info status by default", () => {
    const renderer = createTestRenderer();
    cleanupHandlers.push(() => renderer.cleanup());

    renderer.render(<Toast message="Saved." />);

    const toast = renderer.container.querySelector("[role='status']");
    expect(toast?.getAttribute("data-tone")).toBe("info");
    expect(toast?.textContent).toContain("Saved.");
  });

  it("renders the error tone when requested", () => {
    const renderer = createTestRenderer();
    cleanupHandlers.push(() => renderer.cleanup());

    renderer.render(<Toast message="Failed." tone="error" />);

    const toast = renderer.container.querySelector("[role='status']");
    expect(toast?.getAttribute("data-tone")).toBe("error");
  });
});
