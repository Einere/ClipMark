import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDocumentStore } from "../../lib/document-store";
import { MarkdownEditor } from "./MarkdownEditor";

describe("MarkdownEditor", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it("scopes the active line highlight to the focused editor state", async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(MarkdownEditor, {
          documentKey: 1,
          store: createDocumentStore("# Title\n\nBody"),
        }),
      );
    });

    const injectedTheme = Array.from(document.head.querySelectorAll("style"))
      .map((style) => style.textContent ?? "")
      .find((text) => text.includes("rgba(0, 91, 192, 0.08)"));

    expect(injectedTheme).toBeDefined();
    expect(injectedTheme).toMatch(/\.cm-focused\s+\.cm-activeLine/);
    expect(injectedTheme).toContain("var(--surface-base)");
    expect(injectedTheme).toContain("var(--color-surface-tint)");

    await act(async () => {
      root.unmount();
    });
  });
});
