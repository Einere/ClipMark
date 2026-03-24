import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownPreview } from "./MarkdownPreview";

const { openExternalUri } = vi.hoisted(() => ({
  openExternalUri: vi.fn().mockResolvedValue(undefined),
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
    expect(container.textContent).not.toContain("Open externally");
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

    const button = Array.from(container.querySelectorAll("button")).find(
      (item) => item.textContent?.includes("Open externally"),
    );
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

  it("renders allowed raw html details blocks so disclosure content can be toggled", async () => {
    await act(async () => {
      root.render(
        createElement(MarkdownPreview, {
          filePath: "/tmp/docs/note.md",
          isExternalMediaAutoLoadEnabled: true,
          markdown:
            "<details><summary>Archive notes</summary><p>Collapsed by default</p></details>",
        }),
      );
    });

    const details = container.querySelector("details");
    const summary = container.querySelector("summary");

    expect(details).not.toBeNull();
    expect(details?.hasAttribute("open")).toBe(false);
    expect(summary?.textContent).toBe("Archive notes");
    expect(details?.textContent).toContain("Collapsed by default");
  });

  it("renders allowed raw html media using the same guarded external-open flow", async () => {
    await act(async () => {
      root.render(
        createElement(MarkdownPreview, {
          filePath: "/tmp/docs/note.md",
          isExternalMediaAutoLoadEnabled: false,
          markdown: '<video src="https://example.com/demo.mp4"></video>',
        }),
      );
    });

    expect(container.querySelector("video")).toBeNull();

    const button = Array.from(container.querySelectorAll("button")).find(
      (item) => item.textContent?.includes("Open externally"),
    );
    expect(button?.textContent).toContain("Open externally");

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(openExternalUri).toHaveBeenCalledWith("https://example.com/demo.mp4");
  });
});
