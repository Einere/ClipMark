import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WelcomeScreen } from "./WelcomeScreen";

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

describe("WelcomeScreen", () => {
  it("renders temporary toast demo buttons in the hero section", () => {
    const renderer = createTestRenderer();
    cleanupHandlers.push(() => renderer.cleanup());

    renderer.render(
      <WelcomeScreen
        onNew={() => undefined}
        onOpen={() => undefined}
        onOpenRecent={() => undefined}
        onToastDemo={() => undefined}
        recentFiles={[]}
      />,
    );

    const toastDemoTitle = renderer.container.querySelector("#welcome-toast-demo-title");
    expect(toastDemoTitle?.textContent).toContain("Preview toast variants");
    expect(renderer.container.textContent).toContain("Info Toast");
    expect(renderer.container.textContent).toContain("Success Toast");
    expect(renderer.container.textContent).toContain("Warning Toast");
    expect(renderer.container.textContent).toContain("Error Toast");
  });

  it("calls the demo callback with each toast variant", () => {
    const renderer = createTestRenderer();
    cleanupHandlers.push(() => renderer.cleanup());
    const onToastDemo = vi.fn();

    renderer.render(
      <WelcomeScreen
        onNew={() => undefined}
        onOpen={() => undefined}
        onOpenRecent={() => undefined}
        onToastDemo={onToastDemo}
        recentFiles={[]}
      />,
    );

    const buttons = Array.from(
      renderer.container.querySelectorAll(".welcome-screen__toast-demo .ui-button"),
    );
    expect(buttons).toHaveLength(4);

    buttons.forEach((button) => {
      act(() => {
        (button as HTMLButtonElement).click();
      });
    });

    expect(onToastDemo).toHaveBeenNthCalledWith(1, "info");
    expect(onToastDemo).toHaveBeenNthCalledWith(2, "success");
    expect(onToastDemo).toHaveBeenNthCalledWith(3, "warning");
    expect(onToastDemo).toHaveBeenNthCalledWith(4, "error");
  });
});
