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
    expect(toast?.getAttribute("data-variant")).toBe("info");
    expect(toast?.getAttribute("data-phase")).toBe("enter");
    expect(toast?.getAttribute("aria-live")).toBe("polite");
    expect(toast?.textContent).toContain("Saved.");
    expect(toast?.textContent).toContain("Note");
  });

  it("renders the error variant as an assertive alert", () => {
    const renderer = createTestRenderer();
    cleanupHandlers.push(() => renderer.cleanup());

    renderer.render(<Toast message="Failed." variant="error" />);

    const toast = renderer.container.querySelector("[role='alert']");
    expect(toast?.getAttribute("data-variant")).toBe("error");
    expect(toast?.getAttribute("aria-live")).toBe("assertive");
    expect(toast?.textContent).toContain("Error");
  });

  it("renders custom title and warning variant", () => {
    const renderer = createTestRenderer();
    cleanupHandlers.push(() => renderer.cleanup());

    renderer.render(
      <Toast
        message="Check the imported markdown before saving."
        title="Review recommended"
        variant="warning"
      />,
    );

    const toast = renderer.container.querySelector("[role='status']");
    expect(toast?.getAttribute("data-variant")).toBe("warning");
    expect(toast?.textContent).toContain("Review recommended");
    expect(toast?.textContent).toContain("Check the imported markdown before saving.");
  });

  it("renders the exit phase when closing", () => {
    const renderer = createTestRenderer();
    cleanupHandlers.push(() => renderer.cleanup());

    renderer.render(<Toast message="Saved." phase="exit" variant="success" />);

    const toast = renderer.container.querySelector("[role='status']");
    expect(toast?.getAttribute("data-phase")).toBe("exit");
    expect(toast?.getAttribute("data-variant")).toBe("success");
  });
});
