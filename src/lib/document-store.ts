import { useSyncExternalStore } from "react";

type Listener = () => void;

export type DocumentStore = {
  getMarkdown: () => string;
  replaceMarkdown: (nextMarkdown: string) => void;
  setMarkdown: (nextMarkdown: string) => void;
  subscribe: (listener: Listener) => () => void;
};

export function createDocumentStore(initialMarkdown = ""): DocumentStore {
  let markdown = initialMarkdown;
  const listeners = new Set<Listener>();

  function emit() {
    listeners.forEach((listener) => listener());
  }

  return {
    getMarkdown() {
      return markdown;
    },
    replaceMarkdown(nextMarkdown: string) {
      if (markdown === nextMarkdown) {
        return;
      }

      markdown = nextMarkdown;
      emit();
    },
    setMarkdown(nextMarkdown: string) {
      if (markdown === nextMarkdown) {
        return;
      }

      markdown = nextMarkdown;
      emit();
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
  return useSyncExternalStore(
    store.subscribe,
    store.getMarkdown,
    store.getMarkdown,
  );
}

export function useDocumentDirty(
  store: DocumentStore,
  savedMarkdown: string,
  enabled: boolean,
) {
  return useSyncExternalStore(
    store.subscribe,
    () => enabled && store.getMarkdown() !== savedMarkdown,
    () => enabled && store.getMarkdown() !== savedMarkdown,
  );
}
