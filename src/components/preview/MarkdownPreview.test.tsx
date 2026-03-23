import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownPreview } from "./MarkdownPreview";

const openExternalUri = vi.fn().mockResolvedValue(undefined);

vi.mock("../../lib/external-link", async () => {
  const actual = await vi.importActual<typeof import("../../lib/external-link")>(
    "../../lib/external-link",
  );

  return {
    ...actual,
    openExternalUri,
  };
});

describe("MarkdownPreview", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    openExternalUri.mockClear();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("opens external links in the default browser instead of navigating the preview", async () => {
    await act(async () => {
      root.render(
        createElement(MarkdownPreview, {
          filePath: "/tmp/docs/note.md",
          isExternalMediaAutoLoadEnabled: true,
          markdown: "[Docs](https://example.com/docs)",
        }),
      );
    });

    const link = container.querySelector("a");
    expect(link?.getAttribute("target")).toBe("_blank");

    await act(async () => {
      link?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(openExternalUri).toHaveBeenCalledWith("https://example.com/docs");
  });

  it("prevents fragment links from moving the preview", async () => {
    await act(async () => {
      root.render(
        createElement(MarkdownPreview, {
          filePath: "/tmp/docs/note.md",
          isExternalMediaAutoLoadEnabled: true,
          markdown: "[Jump](#details)",
        }),
      );
    });

    const link = container.querySelector("a");

    await act(async () => {
      link?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(openExternalUri).not.toHaveBeenCalled();
    expect(link?.getAttribute("href")).toBeNull();
  });

  it("opens allowed auxclick link targets externally", async () => {
    await act(async () => {
      root.render(
        createElement(MarkdownPreview, {
          filePath: "/tmp/docs/note.md",
          isExternalMediaAutoLoadEnabled: true,
          markdown: "[Docs](https://example.com/docs)",
        }),
      );
    });

    const link = container.querySelector("a");

    await act(async () => {
      link?.dispatchEvent(new MouseEvent("auxclick", { bubbles: true, cancelable: true }));
    });

    expect(openExternalUri).toHaveBeenCalledWith("https://example.com/docs");
  });

  it("renders images inline when external media autoload is enabled", async () => {
    await act(async () => {
      root.render(
        createElement(MarkdownPreview, {
          filePath: "/tmp/docs/note.md",
          isExternalMediaAutoLoadEnabled: true,
          markdown: "![System Diagram](https://example.com/diagram.png)",
        }),
      );
    });

    const image = container.querySelector("img");
    expect(image?.getAttribute("src")).toBe("https://example.com/diagram.png");
    expect(container.querySelector("button.preview-uri-card__button")).toBeNull();
  });

  it("renders images as explicit external-open affordances when external media autoload is disabled", async () => {
    await act(async () => {
      root.render(
        createElement(MarkdownPreview, {
          filePath: "/tmp/docs/note.md",
          isExternalMediaAutoLoadEnabled: false,
          markdown: "![System Diagram](https://example.com/diagram.png)",
        }),
      );
    });

    expect(container.querySelector("img")).toBeNull();

    const button = container.querySelector("button.preview-uri-card__button");
    expect(button?.textContent).toContain("Open externally");

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(openExternalUri).toHaveBeenCalledWith("https://example.com/diagram.png");
  });

  it("drops disallowed raw html elements from the preview", async () => {
    await act(async () => {
      root.render(
        createElement(MarkdownPreview, {
          filePath: "/tmp/docs/note.md",
          isExternalMediaAutoLoadEnabled: true,
          markdown:
            '<iframe src="https://example.com/embed"></iframe><details open><summary>More</summary><p>Body</p></details>',
        }),
      );
    });

    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("details")).not.toBeNull();
  });
});
