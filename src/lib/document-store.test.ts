import { describe, expect, it, vi } from "vitest";
import { createDocumentStore } from "./document-store";

describe("createDocumentStore", () => {
  it("updates markdown and notifies subscribers", () => {
    const store = createDocumentStore("hello");
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.setMarkdown("hello world");

    expect(store.getMarkdown()).toBe("hello world");
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it("does not notify subscribers when markdown is unchanged", () => {
    const store = createDocumentStore("hello");
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.setMarkdown("hello");

    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
  });

  it("replaces markdown for a newly opened document", () => {
    const store = createDocumentStore("old");

    store.replaceMarkdown("new");

    expect(store.getMarkdown()).toBe("new");
  });

  it("defers markdown serialization until it is read from a connected source", () => {
    const store = createDocumentStore("old");
    const readMarkdown = vi.fn(() => "new");

    const disconnect = store.connectMarkdownSource(readMarkdown);

    store.notifyMarkdownChanged();

    expect(readMarkdown).not.toHaveBeenCalled();
    expect(store.getRevision()).toBe(1);
    expect(store.getMarkdown()).toBe("new");
    expect(readMarkdown).toHaveBeenCalledTimes(1);

    disconnect();
  });

  it("syncs a pending source update before disconnecting the source", () => {
    const store = createDocumentStore("old");
    const readMarkdown = vi.fn(() => "new");

    const disconnect = store.connectMarkdownSource(readMarkdown);
    store.notifyMarkdownChanged();

    disconnect();

    expect(store.getMarkdown()).toBe("new");
    expect(readMarkdown).toHaveBeenCalledTimes(1);
  });
});
