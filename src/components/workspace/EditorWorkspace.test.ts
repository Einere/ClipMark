import { act } from "react";
import { createElement, createRef } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDocumentStore } from "../../lib/document-store";
import type { MarkdownEditorHandle } from "../editor/MarkdownEditor";
import { EditorWorkspace } from "./EditorWorkspace";

describe("EditorWorkspace", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it("does not render document status in the preview header or footer bar", () => {
    const markup = renderToStaticMarkup(
      createElement(EditorWorkspace, {
        documentKey: 1,
        documentStatus: "edited",
        documentStore: createDocumentStore("# Title"),
        editorRef: createRef<MarkdownEditorHandle>(),
        filePath: "/tmp/note.md",
        isExternalMediaAutoLoadEnabled: true,
        isPreviewVisible: true,
        isTocVisible: false,
        onPathCopy: () => undefined,
        onPathCopyError: () => undefined,
        onEditorFocusChange: () => undefined,
      }),
    );

    expect(markup).toContain("<span>Preview</span>");
    expect(markup).toContain("<footer");
    expect(markup).toContain('title="Click to copy file path"');
    expect(markup).toContain('type="button"');
    expect(markup).toContain(">\/tmp/note.md</button>");
    expect(markup).not.toContain(">Preview</span><span");
    expect(markup).not.toContain("</button><span");
  });

  it("copies the file path when the footer path button is clicked", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const onPathCopy = vi.fn();
    const onPathCopyError = vi.fn();
    const root = createRoot(container);

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    await act(async () => {
      root.render(
        createElement(EditorWorkspace, {
          documentKey: 1,
          documentStatus: "saved",
          documentStore: createDocumentStore("# Title"),
          editorRef: createRef<MarkdownEditorHandle>(),
          filePath: "/tmp/note.md",
          isExternalMediaAutoLoadEnabled: true,
          isPreviewVisible: true,
          isTocVisible: false,
          onPathCopy,
          onPathCopyError,
          onEditorFocusChange: () => undefined,
        }),
      );
    });

    const button = container.querySelector('button[title="Click to copy file path"]');
    expect(button).not.toBeNull();

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(writeText).toHaveBeenCalledWith("/tmp/note.md");
    expect(onPathCopy).toHaveBeenCalledWith("/tmp/note.md");
    expect(onPathCopyError).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });
});
