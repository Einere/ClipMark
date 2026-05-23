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

  useEffect(() => {
    const path = getInitialDocumentPath(search);
    const newDocumentRequested = new URLSearchParams(search).get("new") === "1";
    const requestKey = path ? `path:${path}` : newDocumentRequested ? "new" : null;

    if (!requestKey || consumedRequestRef.current === requestKey) {
      return;
    }

    consumedRequestRef.current = requestKey;

    if (!path) {
      createNewDocument();
      return;
    }

    let cancelled = false;

    void loadRecentDocument(path).then((document) => {
      if (cancelled) {
        return;
      }

      if (document) {
        applyOpenedDocument(document);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [applyOpenedDocument, createNewDocument, loadRecentDocument, search]);
}
