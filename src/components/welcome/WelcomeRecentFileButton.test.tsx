import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WelcomeRecentFileButton } from "./WelcomeRecentFileButton";

describe("WelcomeRecentFileButton", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

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

  it("uses the shared squircle radius class and opens the selected file", async () => {
    const onOpenRecent = vi.fn();

    await act(async () => {
      root.render(
        createElement(
          "ul",
          null,
          createElement(WelcomeRecentFileButton, {
            file: {
              filename: "notes.md",
              path: "/docs/notes.md",
            },
            onOpenRecent,
          }),
        ),
      );
    });

    const button = container.querySelector("button");

    expect(button).not.toBeNull();
    expect(button?.className).toContain("radius-squircle");

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onOpenRecent).toHaveBeenCalledWith("/docs/notes.md");
  });
});
