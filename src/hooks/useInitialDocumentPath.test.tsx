import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getInitialDocumentPath,
  useInitialDocumentPath,
} from "./useInitialDocumentPath";

type OpenedDocumentLike = {
  filename: string;
  markdown: string;
  path: string | null;
};

function Harness({
  applyOpenedDocument,
  loadRecentDocument,
  search,
}: {
  applyOpenedDocument: (document: OpenedDocumentLike) => void;
  loadRecentDocument: (path: string) => Promise<OpenedDocumentLike | null>;
  search: string;
}) {
  useInitialDocumentPath({
    applyOpenedDocument,
    loadRecentDocument,
    search,
  });

  return null;
}

describe("getInitialDocumentPath", () => {
  it("returns the decoded path query parameter", () => {
    expect(getInitialDocumentPath("?path=%2Ftmp%2Fnote.md")).toBe("/tmp/note.md");
  });

  it("returns null when the query string has no path", () => {
    expect(getInitialDocumentPath("?window=document-1")).toBeNull();
  });
});

describe("useInitialDocumentPath", () => {
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

  it("loads the encoded path from the window query string once", async () => {
    const document = {
      filename: "note.md",
      markdown: "# Note",
      path: "/tmp/note.md",
    };
    const loadRecentDocument = vi.fn().mockResolvedValue(document);
    const applyOpenedDocument = vi.fn();

    await act(async () => {
      root.render(createElement(Harness, {
        applyOpenedDocument,
        loadRecentDocument,
        search: "?path=%2Ftmp%2Fnote.md",
      }));
    });

    expect(loadRecentDocument).toHaveBeenCalledWith("/tmp/note.md");
    expect(loadRecentDocument).toHaveBeenCalledTimes(1);
    expect(applyOpenedDocument).toHaveBeenCalledWith(document);

    await act(async () => {
      root.render(createElement(Harness, {
        applyOpenedDocument,
        loadRecentDocument,
        search: "?path=%2Ftmp%2Fnote.md",
      }));
    });

    expect(loadRecentDocument).toHaveBeenCalledTimes(1);
    expect(applyOpenedDocument).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the query string has no path", async () => {
    const loadRecentDocument = vi.fn();
    const applyOpenedDocument = vi.fn();

    await act(async () => {
      root.render(createElement(Harness, {
        applyOpenedDocument,
        loadRecentDocument,
        search: "",
      }));
    });

    expect(loadRecentDocument).not.toHaveBeenCalled();
    expect(applyOpenedDocument).not.toHaveBeenCalled();
  });

  it("does not apply a document when initial path loading returns null", async () => {
    const loadRecentDocument = vi.fn().mockResolvedValue(null);
    const applyOpenedDocument = vi.fn();

    await act(async () => {
      root.render(createElement(Harness, {
        applyOpenedDocument,
        loadRecentDocument,
        search: "?path=%2Ftmp%2Fmissing.md",
      }));
    });

    expect(loadRecentDocument).toHaveBeenCalledWith("/tmp/missing.md");
    expect(applyOpenedDocument).not.toHaveBeenCalled();
  });
});
