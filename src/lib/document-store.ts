import { useSyncExternalStore } from "react";

type Listener = () => void;
type MarkdownSourceReader = () => string;

export type DocumentStore = {
  connectMarkdownSource: (readMarkdown: MarkdownSourceReader) => () => void;
  getMarkdown: () => string;
  getRevision: () => number;
  notifyMarkdownChanged: () => void;
  replaceMarkdown: (nextMarkdown: string) => void;
  setMarkdown: (nextMarkdown: string) => void;
  subscribe: (listener: Listener) => () => void;
};

export function createDocumentStore(initialMarkdown = ""): DocumentStore {
  let markdown = initialMarkdown;
  let revision = 0;
  let markdownSource: MarkdownSourceReader | null = null;
  let hasPendingSourceUpdate = false;
  const listeners = new Set<Listener>();

  function emit() {
    listeners.forEach((listener) => listener());
  }

  function readFromSourceIfNeeded() {
    if (!hasPendingSourceUpdate || markdownSource === null) {
      return markdown;
    }

    markdown = markdownSource();
    hasPendingSourceUpdate = false;
    return markdown;
  }

  function updateMarkdown(nextMarkdown: string) {
    if (markdown === nextMarkdown && !hasPendingSourceUpdate) {
      return;
    }

    markdown = nextMarkdown;
    hasPendingSourceUpdate = false;
    revision += 1;
    emit();
  }

  return {
    connectMarkdownSource(readMarkdown) {
      markdownSource = readMarkdown;
      hasPendingSourceUpdate = false;

      return () => {
        if (markdownSource !== readMarkdown) {
          return;
        }

        readFromSourceIfNeeded();
        markdownSource = null;
      };
    },
    getMarkdown() {
      return readFromSourceIfNeeded();
    },
    getRevision() {
      return revision;
    },
    notifyMarkdownChanged() {
      if (markdownSource === null) {
        revision += 1;
        emit();
        return;
      }

      hasPendingSourceUpdate = true;
      revision += 1;
      emit();
    },
    replaceMarkdown(nextMarkdown: string) {
      updateMarkdown(nextMarkdown);
    },
    setMarkdown(nextMarkdown: string) {
      updateMarkdown(nextMarkdown);
    },
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function useDocumentMarkdown(store: DocumentStore) {
  useSyncExternalStore(
    store.subscribe,
    store.getRevision,
    store.getRevision,
  );

  return store.getMarkdown();
}

export function useDocumentDirty(
  store: DocumentStore,
  savedRevision: number,
  enabled: boolean,
) {
  return useSyncExternalStore(
    store.subscribe,
    () => enabled && store.getRevision() !== savedRevision,
    () => enabled && store.getRevision() !== savedRevision,
  );
}
