import { isTauriRuntime } from "./file-system";

export const NATIVE_OPEN_DOCUMENT_EVENT = "clipmark://open-document";

type NativeOpenDocumentPayload = {
  path?: unknown;
};

export async function setupNativeOpenDocumentListener(
  onOpenDocument: (path: string) => void,
): Promise<(() => void) | undefined> {
  if (!isTauriRuntime()) {
    return undefined;
  }

  const { listen } = await import("@tauri-apps/api/event");

  return listen<NativeOpenDocumentPayload>(
    NATIVE_OPEN_DOCUMENT_EVENT,
    (event) => {
      const path = event.payload?.path;
      if (typeof path !== "string" || path.length === 0) {
        return;
      }

      onOpenDocument(path);
    },
  );
}
