import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarkdownPreview } from "./MarkdownPreview";

const { openExternalUri } = vi.hoisted(() => ({
  openExternalUri: vi.fn(async () => undefined),
}));

vi.mock("../../lib/external-link", async () => {
  const actual = await vi.importActual<typeof import("../../lib/external-link")>(
    "../../lib/external-link",
  );

  return {
    ...actual,
    openExternalUri,
  };
});

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
    render() {
      act(() => {
        root.render(
          <MarkdownPreview
            filePath="/tmp/docs/note.md"
            isExternalMediaAutoLoadEnabled={false}
            markdown="[Docs](./reference.md)\n\n![Spec image](https://example.com/spec.png)"
          />,
        );
      });
    },
  };
}

const cleanupHandlers: Array<() => void> = [];

afterEach(() => {
  openExternalUri.mockClear();

  while (cleanupHandlers.length > 0) {
    cleanupHandlers.pop()?.();
  }
});

describe("MarkdownPreview", () => {
  it("opens resolved links through delegated click handling", () => {
    const renderer = createTestRenderer();
    cleanupHandlers.push(() => renderer.cleanup());
    renderer.render();

    const link = renderer.container.querySelector("[data-preview-uri='file:///tmp/docs/reference.md']");
    expect(link).toBeInstanceOf(HTMLElement);

    act(() => {
      link?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(openExternalUri).toHaveBeenCalledWith("file:///tmp/docs/reference.md");
  });

  it("opens media cards through delegated button handling", () => {
    const renderer = createTestRenderer();
    cleanupHandlers.push(() => renderer.cleanup());
    renderer.render();

    const button = renderer.container.querySelector(
      "[data-preview-open-uri='https://example.com/spec.png']",
    );
    expect(button).toBeInstanceOf(HTMLButtonElement);

    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(openExternalUri).toHaveBeenCalledWith("https://example.com/spec.png");
  });

  it("opens resolved links through delegated keyboard handling", () => {
    const renderer = createTestRenderer();
    cleanupHandlers.push(() => renderer.cleanup());
    renderer.render();

    const link = renderer.container.querySelector(
      "[data-preview-uri='file:///tmp/docs/reference.md']",
    );
    expect(link).toBeInstanceOf(HTMLElement);

    act(() => {
      link?.dispatchEvent(new KeyboardEvent("keydown", {
        bubbles: true,
        key: "Enter",
      }));
    });

    expect(openExternalUri).toHaveBeenCalledWith("file:///tmp/docs/reference.md");
  });
});
