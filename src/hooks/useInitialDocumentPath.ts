import { useEffect, useRef } from "react";

type OpenedDocumentLike = {
  filename: string;
  markdown: string;
  path: string | null;
};

type UseInitialDocumentPathOptions = {
  applyOpenedDocument: (document: OpenedDocumentLike) => void;
  createNewDocument: () => void;
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
  loadRecentDocument,
  search = window.location.search,
}: UseInitialDocumentPathOptions) {
  const consumedRequestRef = useRef<string | null>(null);
  const applyOpenedDocumentRef = useRef(applyOpenedDocument);
  const createNewDocumentRef = useRef(createNewDocument);
  const loadRecentDocumentRef = useRef(loadRecentDocument);

  applyOpenedDocumentRef.current = applyOpenedDocument;
  createNewDocumentRef.current = createNewDocument;
  loadRecentDocumentRef.current = loadRecentDocument;

  useEffect(() => {
    const path = getInitialDocumentPath(search);
    const newDocumentRequested = new URLSearchParams(search).get("new") === "1";
    const requestKey = path ? `path:${path}` : newDocumentRequested ? "new" : null;

    if (!requestKey || consumedRequestRef.current === requestKey) {
      return;
    }

    consumedRequestRef.current = requestKey;

    if (!path) {
      createNewDocumentRef.current();
      return;
    }

    let cancelled = false;

    void loadRecentDocumentRef.current(path).then((document) => {
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
