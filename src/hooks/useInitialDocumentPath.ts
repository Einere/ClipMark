import { useEffect, useRef } from "react";
import {
  getInitialDocumentWindowState,
  type InitialDocumentWindowState,
} from "../lib/document-window";

type OpenedDocumentLike = {
  filename: string;
  markdown: string;
  path: string | null;
};

type UseInitialDocumentPathOptions = {
  applyOpenedDocument: (document: OpenedDocumentLike) => void;
  createNewDocument: () => void;
  loadInitialDocumentWindowState?: () => Promise<InitialDocumentWindowState | null>;
  loadRecentDocument: (path: string) => Promise<OpenedDocumentLike | null>;
  search?: string;
};

export function getInitialDocumentPath(search: string): string | null {
  const params = new URLSearchParams(search);
  const path = params.get("path");

  return path && path.length > 0 ? path : null;
}

export function useInitialDocumentPath({
  applyOpenedDocument,
  createNewDocument,
  loadInitialDocumentWindowState = getInitialDocumentWindowState,
  loadRecentDocument,
  search = window.location.search,
}: UseInitialDocumentPathOptions) {
  const consumedRequestRef = useRef<string | null>(null);
  const applyOpenedDocumentRef = useRef(applyOpenedDocument);
  const createNewDocumentRef = useRef(createNewDocument);
  const loadInitialDocumentWindowStateRef = useRef(loadInitialDocumentWindowState);
  const loadRecentDocumentRef = useRef(loadRecentDocument);

  applyOpenedDocumentRef.current = applyOpenedDocument;
  createNewDocumentRef.current = createNewDocument;
  loadInitialDocumentWindowStateRef.current = loadInitialDocumentWindowState;
  loadRecentDocumentRef.current = loadRecentDocument;

  useEffect(() => {
    let cancelled = false;

    void loadInitialDocumentWindowStateRef.current()
      .catch(() => null)
      .then(async (windowState) => {
        if (cancelled) {
          return;
        }

        const queryPath = getInitialDocumentPath(search);
        const path = windowState?.path ?? queryPath;
        const newDocumentRequested = windowState?.isNewDocument
          || (!path && new URLSearchParams(search).get("new") === "1");
        const requestKey = path ? `path:${path}` : newDocumentRequested ? "new" : null;

        if (!requestKey || consumedRequestRef.current === requestKey) {
          return;
        }

        consumedRequestRef.current = requestKey;

        if (!path) {
          createNewDocumentRef.current();
          return;
        }

        const document = await loadRecentDocumentRef.current(path);
        if (cancelled) {
          return;
        }

        if (document) {
          applyOpenedDocumentRef.current(document);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [search]);
}
