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

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

function Harness({
  applyOpenedDocument,
  createNewDocument,
  loadRecentDocument,
  search,
}: {
  applyOpenedDocument: (document: OpenedDocumentLike) => void;
  createNewDocument: () => void;
  loadRecentDocument: (path: string) => Promise<OpenedDocumentLike | null>;
  search: string;
}) {
  useInitialDocumentPath({
    applyOpenedDocument,
    createNewDocument,
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
    const createNewDocument = vi.fn();

    await act(async () => {
      root.render(createElement(Harness, {
        applyOpenedDocument,
        createNewDocument,
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
        createNewDocument,
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
    const createNewDocument = vi.fn();

    await act(async () => {
      root.render(createElement(Harness, {
        applyOpenedDocument,
        createNewDocument,
        loadRecentDocument,
        search: "",
      }));
    });

    expect(loadRecentDocument).not.toHaveBeenCalled();
    expect(applyOpenedDocument).not.toHaveBeenCalled();
    expect(createNewDocument).not.toHaveBeenCalled();
  });

  it("creates a blank document when the window query requests a new document", async () => {
    const loadRecentDocument = vi.fn();
    const applyOpenedDocument = vi.fn();
    const createNewDocument = vi.fn();

    await act(async () => {
      root.render(createElement(Harness, {
        applyOpenedDocument,
        createNewDocument,
        loadRecentDocument,
        search: "?new=1",
      }));
    });

    expect(createNewDocument).toHaveBeenCalledTimes(1);
    expect(loadRecentDocument).not.toHaveBeenCalled();
    expect(applyOpenedDocument).not.toHaveBeenCalled();
  });

  it("does not apply a document when initial path loading returns null", async () => {
    const loadRecentDocument = vi.fn().mockResolvedValue(null);
    const applyOpenedDocument = vi.fn();
    const createNewDocument = vi.fn();

    await act(async () => {
      root.render(createElement(Harness, {
        applyOpenedDocument,
        createNewDocument,
        loadRecentDocument,
        search: "?path=%2Ftmp%2Fmissing.md",
      }));
    });

    expect(loadRecentDocument).toHaveBeenCalledWith("/tmp/missing.md");
    expect(applyOpenedDocument).not.toHaveBeenCalled();
  });

  it("does not apply a document after the hook unmounts before loading resolves", async () => {
    const document = {
      filename: "late.md",
      markdown: "# Late",
      path: "/tmp/late.md",
    };
    const deferred = createDeferred<OpenedDocumentLike | null>();
    const loadRecentDocument = vi.fn(() => deferred.promise);
    const applyOpenedDocument = vi.fn();
    const createNewDocument = vi.fn();

    await act(async () => {
      root.render(createElement(Harness, {
        applyOpenedDocument,
        createNewDocument,
        loadRecentDocument,
        search: "?path=%2Ftmp%2Flate.md",
      }));
    });

    await act(async () => {
      root.unmount();
    });

    await act(async () => {
      deferred.resolve(document);
      await deferred.promise;
    });

    expect(loadRecentDocument).toHaveBeenCalledWith("/tmp/late.md");
    expect(applyOpenedDocument).not.toHaveBeenCalled();
  });

  it("does not apply an older path when it resolves after the search changes", async () => {
    const firstDocument = {
      filename: "first.md",
      markdown: "# First",
      path: "/tmp/first.md",
    };
    const secondDocument = {
      filename: "second.md",
      markdown: "# Second",
      path: "/tmp/second.md",
    };
    const firstDeferred = createDeferred<OpenedDocumentLike | null>();
    const secondDeferred = createDeferred<OpenedDocumentLike | null>();
    const loadRecentDocument = vi
      .fn()
      .mockReturnValueOnce(firstDeferred.promise)
      .mockReturnValueOnce(secondDeferred.promise);
    const applyOpenedDocument = vi.fn();
    const createNewDocument = vi.fn();

    await act(async () => {
      root.render(createElement(Harness, {
        applyOpenedDocument,
        createNewDocument,
        loadRecentDocument,
        search: "?path=%2Ftmp%2Ffirst.md",
      }));
    });

    await act(async () => {
      root.render(createElement(Harness, {
        applyOpenedDocument,
        createNewDocument,
        loadRecentDocument,
        search: "?path=%2Ftmp%2Fsecond.md",
      }));
    });

    await act(async () => {
      secondDeferred.resolve(secondDocument);
      await secondDeferred.promise;
    });

    await act(async () => {
      firstDeferred.resolve(firstDocument);
      await firstDeferred.promise;
    });

    expect(loadRecentDocument).toHaveBeenCalledWith("/tmp/first.md");
    expect(loadRecentDocument).toHaveBeenCalledWith("/tmp/second.md");
    expect(applyOpenedDocument).toHaveBeenCalledTimes(1);
    expect(applyOpenedDocument).toHaveBeenCalledWith(secondDocument);
  });

  it("keeps the initial path load alive when callback identities change during a rerender", async () => {
    const document = {
      filename: "stable.md",
      markdown: "# Stable",
      path: "/tmp/stable.md",
    };
    const deferred = createDeferred<OpenedDocumentLike | null>();
    const firstLoadRecentDocument = vi.fn(() => deferred.promise);
    const secondLoadRecentDocument = vi.fn(() => Promise.resolve(null));
    const firstApplyOpenedDocument = vi.fn();
    const secondApplyOpenedDocument = vi.fn();
    const createNewDocument = vi.fn();

    await act(async () => {
      root.render(createElement(Harness, {
        applyOpenedDocument: firstApplyOpenedDocument,
        createNewDocument,
        loadRecentDocument: firstLoadRecentDocument,
        search: "?path=%2Ftmp%2Fstable.md",
      }));
    });

    await act(async () => {
      root.render(createElement(Harness, {
        applyOpenedDocument: secondApplyOpenedDocument,
        createNewDocument,
        loadRecentDocument: secondLoadRecentDocument,
        search: "?path=%2Ftmp%2Fstable.md",
      }));
    });

    await act(async () => {
      deferred.resolve(document);
      await deferred.promise;
    });

    expect(firstLoadRecentDocument).toHaveBeenCalledTimes(1);
    expect(secondLoadRecentDocument).not.toHaveBeenCalled();
    expect(firstApplyOpenedDocument).not.toHaveBeenCalled();
    expect(secondApplyOpenedDocument).toHaveBeenCalledWith(document);
  });
});
