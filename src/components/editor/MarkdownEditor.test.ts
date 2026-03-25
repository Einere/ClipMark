import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { highlightingFor, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { createDocumentStore } from "../../lib/document-store";
import { EditorViewStateProvider } from "../../hooks/useEditorViewState";
import { markdownEditorHighlightStyle } from "./MarkdownEditor";
import { MarkdownEditor } from "./MarkdownEditor";

const cleanupHandlers: Array<() => void> = [];

afterEach(() => {
  while (cleanupHandlers.length > 0) {
    cleanupHandlers.pop()?.();
  }
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
    render(element: ReactNode) {
      act(() => {
        root.render(element);
      });
    },
  };
}

describe("MarkdownEditor highlighting", () => {
  it("registers a highlight style for markdown links", () => {
    const state = EditorState.create({
      extensions: [syntaxHighlighting(markdownEditorHighlightStyle)],
    });

    expect(highlightingFor(state, [tags.link])).toBeTruthy();
    expect(highlightingFor(state, [tags.url])).toBeTruthy();
    expect(markdownEditorHighlightStyle.specs).toEqual([
      expect.objectContaining({
        color: "var(--color-editor-link)",
      }),
    ]);
  });

  it("opens the CodeMirror search panel from the editor keybinding", () => {
    const renderer = createTestRenderer();
    cleanupHandlers.push(() => renderer.cleanup());

    renderer.render(
      createElement(
        EditorViewStateProvider,
        { documentKey: 1 },
        createElement(MarkdownEditor, {
          documentKey: 1,
          store: createDocumentStore("alpha beta gamma"),
        }),
      ),
    );

    const editorContent = renderer.container.querySelector(".cm-content");
    expect(editorContent).toBeTruthy();

    act(() => {
      (editorContent as HTMLElement).dispatchEvent(new FocusEvent("focus", { bubbles: true }));
      editorContent?.dispatchEvent(new KeyboardEvent("keydown", {
        bubbles: true,
        ctrlKey: true,
        key: "f",
      }));
      editorContent?.dispatchEvent(new KeyboardEvent("keydown", {
        bubbles: true,
        key: "f",
        metaKey: true,
      }));
    });

    expect(renderer.container.querySelector(".cm-search")).toBeTruthy();
  });

  it("enables fold gutter and bracket matching decorations", () => {
    const renderer = createTestRenderer();
    cleanupHandlers.push(() => renderer.cleanup());

    renderer.render(
      createElement(
        EditorViewStateProvider,
        { documentKey: 1 },
        createElement(MarkdownEditor, {
          documentKey: 1,
          store: createDocumentStore("(alpha)\n# Heading\n\nBody\n"),
        }),
      ),
    );

    const editorContent = renderer.container.querySelector(".cm-content");
    expect(editorContent).toBeTruthy();

    act(() => {
      (editorContent as HTMLElement).dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    });

    expect(renderer.container.querySelector(".cm-foldGutter")).toBeTruthy();
    expect(renderer.container.querySelector(".cm-matchingBracket")).toBeTruthy();
  });
});
