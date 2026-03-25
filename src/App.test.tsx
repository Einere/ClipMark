import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { AppShellFallback } from "./App";

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

describe("AppShellFallback", () => {
  it("announces that the editor workspace is loading", () => {
    const renderer = createTestRenderer();
    cleanupHandlers.push(() => renderer.cleanup());

    renderer.render(<AppShellFallback />);

    const fallback = renderer.container.querySelector("[role='status']");
    expect(fallback?.getAttribute("aria-busy")).toBe("true");
    expect(fallback?.getAttribute("aria-live")).toBe("polite");
    expect(fallback?.textContent).toContain("Opening editor");
    expect(fallback?.textContent).toContain("Preparing your writing workspace.");
  });
});
