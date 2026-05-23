import { useEffect, useRef } from "react";

type OpenedDocumentLike = {
  filename: string;
  markdown: string;
  path: string | null;
};

type UseInitialDocumentPathOptions = {
  applyOpenedDocument: (document: OpenedDocumentLike) => void;
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
  loadRecentDocument,
  search = window.location.search,
}: UseInitialDocumentPathOptions) {
  const consumedPathRef = useRef<string | null>(null);

  useEffect(() => {
    const path = getInitialDocumentPath(search);
    if (!path || consumedPathRef.current === path) {
      return;
    }

    consumedPathRef.current = path;
    void loadRecentDocument(path).then((document) => {
      if (document) {
        applyOpenedDocument(document);
      }
    });
  }, [applyOpenedDocument, loadRecentDocument, search]);
}
