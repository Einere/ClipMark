import { createElement, createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createDocumentStore } from "../../lib/document-store";
import type { MarkdownEditorHandle } from "../editor/MarkdownEditor";
import { EditorWorkspace } from "./EditorWorkspace";

describe("EditorWorkspace", () => {
  it("does not render document status in the preview header or footer bar", () => {
    const markup = renderToStaticMarkup(
      createElement(EditorWorkspace, {
        documentKey: 1,
        documentStatus: "edited",
        documentStore: createDocumentStore("# Title"),
        editorRef: createRef<MarkdownEditorHandle>(),
        filePath: "/tmp/note.md",
        isPreviewVisible: true,
        isTocVisible: false,
        onEditorFocusChange: () => undefined,
      }),
    );

    expect(markup).toContain('<div class="panel__header"><span>Preview</span></div>');
    expect(markup).toContain('<footer class="footer-bar"><span class="footer-bar__path">/tmp/note.md</span></footer>');
    expect(markup).not.toContain('Preview</span><span class="status">');
    expect(markup).not.toContain('<footer class="footer-bar"><span class="footer-bar__path">/tmp/note.md</span><span');
  });
});
