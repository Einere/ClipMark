import { useEffect, useEffectEvent } from "react";
import { setupNativeOpenDocumentListener } from "../lib/native-open-document";

type UseNativeOpenDocumentListenerOptions = {
  onOpenDocument: (path: string) => void;
};

export function useNativeOpenDocumentListener({
  onOpenDocument,
}: UseNativeOpenDocumentListenerOptions) {
  const handleNativeOpenDocument = useEffectEvent((path: string) => {
    onOpenDocument(path);
  });

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let disposed = false;

    void setupNativeOpenDocumentListener(handleNativeOpenDocument).then((dispose) => {
      if (disposed) {
        dispose?.();
        return;
      }

      cleanup = dispose;
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [handleNativeOpenDocument]);
}
