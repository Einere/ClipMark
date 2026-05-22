import { act, type ComponentProps } from "react";
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
    render(props: Partial<ComponentProps<typeof MarkdownPreview>> = {}) {
      act(() => {
        root.render(
          <MarkdownPreview
            activeLine={null}
            filePath="/tmp/docs/note.md"
            isAutoScrollEnabled
            isExternalMediaAutoLoadEnabled={false}
            markdown="[Docs](./reference.md)\n\n![Spec image](https://example.com/spec.png)"
            {...props}
          />,
        );
      });
    },
  };
}

const cleanupHandlers: Array<() => void> = [];

afterEach(() => {
  openExternalUri.mockClear();
  vi.restoreAllMocks();

  while (cleanupHandlers.length > 0) {
    cleanupHandlers.pop()?.();
  }
});

describe("MarkdownPreview", () => {
  it("coalesces rapid active line changes into the latest scheduled scroll", () => {
    vi.useFakeTimers();
    cleanupHandlers.push(() => vi.useRealTimers());

    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => window.setTimeout(() => callback(performance.now()), 16));
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation((handle) => window.clearTimeout(handle));
    cleanupHandlers.push(() => {
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
    });

    const renderer = createTestRenderer();
    cleanupHandlers.push(() => renderer.cleanup());

    const scrollTo = vi.fn(function setScrollTop(this: HTMLElement, options: ScrollToOptions) {
      this.scrollTop = options.top ?? 0;
    });
    const originalScrollTo = HTMLElement.prototype.scrollTo;
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollTo,
      writable: true,
    });
    cleanupHandlers.push(() => {
      if (originalScrollTo) {
        Object.defineProperty(HTMLElement.prototype, "scrollTo", {
          configurable: true,
          value: originalScrollTo,
          writable: true,
        });
        return;
      }

      delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTo;
    });

    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function getClientHeight(this: HTMLElement) {
      return this.classList.contains("markdown-preview") ? 400 : 0;
    });
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function getScrollHeight(this: HTMLElement) {
      return this.classList.contains("markdown-preview") ? 1400 : 0;
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getRect(this: HTMLElement) {
      if (this.classList.contains("markdown-preview")) {
        return new DOMRect(0, 0, 320, 400);
      }

      const lineStart = Number(this.dataset.sourceLineStart ?? NaN);
      if (lineStart === 5) {
        return new DOMRect(0, 520, 320, 48);
      }
      if (lineStart === 7) {
        return new DOMRect(0, 760, 320, 48);
      }

      return new DOMRect(0, 0, 0, 0);
    });

    renderer.render({
      activeLine: 5,
      markdown: "# Heading\n\nFirst paragraph\n\n## Section\n\nSecond paragraph",
    });
    renderer.render({
      activeLine: 7,
      markdown: "# Heading\n\nFirst paragraph\n\n## Section\n\nSecond paragraph",
    });

    expect(cancelAnimationFrameSpy).toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({
      top: 640,
    }));
  });

  it("does not scroll solely because the layout version changes", () => {
    vi.useFakeTimers();
    cleanupHandlers.push(() => vi.useRealTimers());

    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => window.setTimeout(() => callback(performance.now()), 16));
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation((handle) => window.clearTimeout(handle));
    cleanupHandlers.push(() => {
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
    });

    const renderer = createTestRenderer();
    cleanupHandlers.push(() => renderer.cleanup());

    const scrollTo = vi.fn(function setScrollTop(this: HTMLElement, options: ScrollToOptions) {
      this.scrollTop = options.top ?? 0;
    });
    const originalScrollTo = HTMLElement.prototype.scrollTo;
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollTo,
      writable: true,
    });
    cleanupHandlers.push(() => {
      if (originalScrollTo) {
        Object.defineProperty(HTMLElement.prototype, "scrollTo", {
          configurable: true,
          value: originalScrollTo,
          writable: true,
        });
        return;
      }

      delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTo;
    });

    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function getClientHeight(this: HTMLElement) {
      return this.classList.contains("markdown-preview") ? 400 : 0;
    });
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function getScrollHeight(this: HTMLElement) {
      return this.classList.contains("markdown-preview") ? 1200 : 0;
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getRect(this: HTMLElement) {
      if (this.classList.contains("markdown-preview")) {
        return new DOMRect(0, 0, 320, 400);
      }

      const lineStart = Number(this.dataset.sourceLineStart ?? NaN);
      if (lineStart === 5) {
        return new DOMRect(0, 520, 320, 48);
      }

      return new DOMRect(0, 0, 0, 0);
    });

    renderer.render({
      activeLine: 5,
      layoutVersion: 0,
      markdown: "# Heading\n\nFirst paragraph\n\n## Section\n\nSecond paragraph",
    });
    act(() => {
      vi.advanceTimersByTime(16);
    });
    const initialCallCount = scrollTo.mock.calls.length;
    expect(initialCallCount).toBeGreaterThan(0);

    renderer.render({
      activeLine: 5,
      layoutVersion: 1,
      markdown: "# Heading\n\nFirst paragraph\n\n## Section\n\nSecond paragraph",
    });
    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(scrollTo).toHaveBeenCalledTimes(initialCallCount);
  });

  it("cancels a pending scheduled preview scroll on unmount", () => {
    vi.useFakeTimers();
    cleanupHandlers.push(() => vi.useRealTimers());

    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => window.setTimeout(() => callback(performance.now()), 16));
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation((handle) => window.clearTimeout(handle));
    cleanupHandlers.push(() => {
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
    });

    const renderer = createTestRenderer();
    let didCleanup = false;
    cleanupHandlers.push(() => {
      if (!didCleanup) {
        renderer.cleanup();
      }
    });

    renderer.render({
      activeLine: 5,
      markdown: "# Heading\n\nFirst paragraph\n\n## Section\n\nSecond paragraph",
    });
    expect(requestAnimationFrameSpy).toHaveBeenCalled();

    renderer.cleanup();
    didCleanup = true;

    expect(cancelAnimationFrameSpy).toHaveBeenCalled();
  });

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

  it("scrolls the preview when the active line changes to an off-screen block", () => {
    vi.useFakeTimers();
    cleanupHandlers.push(() => vi.useRealTimers());

    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => window.setTimeout(() => callback(performance.now()), 16));
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation((handle) => window.clearTimeout(handle));
    cleanupHandlers.push(() => {
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
    });

    const renderer = createTestRenderer();
    cleanupHandlers.push(() => renderer.cleanup());
    renderer.render({
      markdown: "# Heading\n\nFirst paragraph\n\n## Section\n\nSecond paragraph",
    });

    const anchors = renderer.container.querySelectorAll<HTMLElement>("[data-source-line-start]");
    expect(anchors).toHaveLength(4);
    const topByLineStart = new Map([
      [1, 16],
      [3, 180],
      [5, 520],
      [7, 760],
    ]);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function getClientHeight(this: HTMLElement) {
      return this.classList.contains("markdown-preview") ? 400 : 0;
    });
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function getScrollHeight(this: HTMLElement) {
      return this.classList.contains("markdown-preview") ? 1200 : 0;
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getRect(this: HTMLElement) {
      if (this.classList.contains("markdown-preview")) {
        return new DOMRect(0, 0, 320, 400);
      }

      const lineStart = Number(this.dataset.sourceLineStart ?? NaN);
      const top = topByLineStart.get(lineStart);
      if (top !== undefined) {
        return new DOMRect(0, top, 320, 48);
      }

      return new DOMRect(0, 0, 0, 0);
    });
    const originalScrollTo = HTMLElement.prototype.scrollTo;
    const scrollTo = vi.fn(function setScrollTop(this: HTMLElement, options: ScrollToOptions) {
      this.scrollTop = options.top ?? 0;
    });
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollTo,
      writable: true,
    });
    cleanupHandlers.push(() => {
      if (originalScrollTo) {
        Object.defineProperty(HTMLElement.prototype, "scrollTo", {
          configurable: true,
          value: originalScrollTo,
          writable: true,
        });
        return;
      }

      delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTo;
    });

    renderer.render({
      activeLine: 5,
      markdown: "# Heading\n\nFirst paragraph\n\n## Section\n\nSecond paragraph",
    });

    act(() => {
      vi.advanceTimersByTime(16);
    });

    const previewElement = renderer.container.querySelector(".markdown-preview") as HTMLDivElement | null;
    expect(previewElement).toBeTruthy();
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({
      behavior: "auto",
    }));
    expect(previewElement?.scrollTop).toBeGreaterThan(0);
  });

  it("does not scroll while the active line stays inside the same preview anchor", () => {
    vi.useFakeTimers();
    cleanupHandlers.push(() => vi.useRealTimers());

    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => window.setTimeout(() => callback(performance.now()), 16));
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation((handle) => window.clearTimeout(handle));
    cleanupHandlers.push(() => {
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
    });

    const renderer = createTestRenderer();
    cleanupHandlers.push(() => renderer.cleanup());

    const scrollTo = vi.fn(function setScrollTop(this: HTMLElement, options: ScrollToOptions) {
      this.scrollTop = options.top ?? 0;
    });
    const originalScrollTo = HTMLElement.prototype.scrollTo;
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollTo,
      writable: true,
    });
    cleanupHandlers.push(() => {
      if (originalScrollTo) {
        Object.defineProperty(HTMLElement.prototype, "scrollTo", {
          configurable: true,
          value: originalScrollTo,
          writable: true,
        });
        return;
      }

      delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTo;
    });

    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function getClientHeight(this: HTMLElement) {
      return this.classList.contains("markdown-preview") ? 400 : 0;
    });
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function getScrollHeight(this: HTMLElement) {
      return this.classList.contains("markdown-preview") ? 1200 : 0;
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getRect(this: HTMLElement) {
      if (this.classList.contains("markdown-preview")) {
        return new DOMRect(0, 0, 320, 400);
      }

      if (this.dataset.sourceLineStart === "1") {
        return new DOMRect(0, 520, 320, 120);
      }

      return new DOMRect(0, 0, 0, 0);
    });

    renderer.render({
      activeLine: 1,
      markdown: "First line\nSecond line\nThird line",
    });
    act(() => {
      vi.advanceTimersByTime(16);
    });

    const anchor = renderer.container.querySelector<HTMLElement>("[data-source-line-start='1']");
    expect(anchor).toBeInstanceOf(HTMLElement);
    expect(anchor?.dataset.sourceLineEnd).toBe("3");
    const initialCallCount = scrollTo.mock.calls.length;
    expect(initialCallCount).toBeGreaterThan(0);

    renderer.render({
      activeLine: 2,
      markdown: "First line\nSecond line\nThird line",
    });
    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(scrollTo).toHaveBeenCalledTimes(initialCallCount);
  });

  it("does not scroll again when only the preview html changes for the same active anchor", () => {
    const renderer = createTestRenderer();
    cleanupHandlers.push(() => renderer.cleanup());

    const originalScrollTo = HTMLElement.prototype.scrollTo;
    const scrollTo = vi.fn(function setScrollTop(this: HTMLElement, options: ScrollToOptions) {
      this.scrollTop = options.top ?? 0;
    });
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollTo,
      writable: true,
    });
    cleanupHandlers.push(() => {
      if (originalScrollTo) {
        Object.defineProperty(HTMLElement.prototype, "scrollTo", {
          configurable: true,
          value: originalScrollTo,
          writable: true,
        });
        return;
      }

      delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTo;
    });

    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function getClientHeight(this: HTMLElement) {
      return this.classList.contains("markdown-preview") ? 400 : 0;
    });
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function getScrollHeight(this: HTMLElement) {
      return this.classList.contains("markdown-preview") ? 1200 : 0;
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getRect(this: HTMLElement) {
      if (this.classList.contains("markdown-preview")) {
        return new DOMRect(0, 0, 320, 400);
      }

      const lineStart = Number(this.dataset.sourceLineStart ?? NaN);
      if (lineStart === 5) {
        return new DOMRect(0, 520, 320, 48);
      }

      return new DOMRect(0, 0, 0, 0);
    });

    renderer.render({
      activeLine: 5,
      markdown: "# Heading\n\nFirst paragraph\n\n## Section\n\nSecond paragraph",
    });
    const initialCallCount = scrollTo.mock.calls.length;

    renderer.render({
      activeLine: 5,
      markdown: "# Heading\n\nFirst paragraph\n\n## Section updated\n\nSecond paragraph",
    });

    expect(scrollTo).toHaveBeenCalledTimes(initialCallCount);
  });

  it("does not scroll the preview when auto-scroll is disabled", () => {
    const renderer = createTestRenderer();
    cleanupHandlers.push(() => renderer.cleanup());
    renderer.render({
      markdown: "# Heading\n\nBody",
    });

    const previewElement = renderer.container.querySelector(".markdown-preview") as HTMLDivElement | null;
    const heading = renderer.container.querySelector<HTMLElement>("[data-source-line-start='1']");
    expect(previewElement).toBeTruthy();
    expect(heading).toBeTruthy();

    Object.defineProperty(previewElement, "clientHeight", {
      configurable: true,
      value: 300,
    });
    Object.defineProperty(previewElement, "scrollTop", {
      configurable: true,
      value: 0,
      writable: true,
    });
    Object.defineProperty(previewElement, "scrollHeight", {
      configurable: true,
      value: 900,
    });
    previewElement!.getBoundingClientRect = () => new DOMRect(0, 0, 320, 300);
    heading!.getBoundingClientRect = () => new DOMRect(0, 500, 320, 48);

    renderer.render({
      activeLine: 1,
      isAutoScrollEnabled: false,
      markdown: "# Heading\n\nBody",
    });

    expect(previewElement?.scrollTop ?? 0).toBe(0);
  });
});
