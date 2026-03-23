import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./file-system";

const EXTERNAL_OPEN_PROTOCOLS = new Set([
  "file:",
  "http:",
  "https:",
  "mailto:",
  "tel:",
]);

export type ResolvedPreviewUri =
  | {
      kind: "external";
      uri: string;
    }
  | {
      kind: "fragment" | "blocked" | "invalid";
    };

function toFileUrl(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const prefixed = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return encodeURI(`file://${prefixed}`);
}

export function resolvePreviewUri(
  rawUri: string,
  currentFilePath: string | null,
): ResolvedPreviewUri {
  const trimmedUri = rawUri.trim();
  if (!trimmedUri) {
    return { kind: "invalid" };
  }

  if (trimmedUri.startsWith("#")) {
    return { kind: "fragment" };
  }

  try {
    const url = currentFilePath
      ? new URL(trimmedUri, toFileUrl(currentFilePath))
      : new URL(trimmedUri);

    if (!EXTERNAL_OPEN_PROTOCOLS.has(url.protocol)) {
      return { kind: "blocked" };
    }

    return {
      kind: "external",
      uri: url.href,
    };
  } catch {
    return { kind: "invalid" };
  }
}

export async function openExternalUri(uri: string) {
  if (isTauriRuntime()) {
    await invoke("open_external_url", { url: uri });
    return;
  }

  window.open(uri, "_blank", "noopener,noreferrer");
}
