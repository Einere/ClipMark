import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { highlightingFor, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { markdownEditorHighlightStyle } from "./MarkdownEditor";

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
});
