import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./file-system";

export type InitialDocumentWindowState = {
  isNewDocument: boolean;
  path: string | null;
};

export async function createDocumentWindow(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("create_document_window");
}

export async function openDocumentWindow(path: string): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("open_document_window", { path });
}

export async function registerWindowDocumentPath(
  path: string | null,
): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("register_window_document_path", { path });
}

export async function isDocumentPathOpenElsewhere(
  path: string,
): Promise<boolean> {
  if (!isTauriRuntime()) {
    return false;
  }

  return invoke<boolean>("is_document_path_open_elsewhere", { path });
}

export async function getInitialDocumentWindowState(): Promise<InitialDocumentWindowState | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  return invoke<InitialDocumentWindowState>("get_initial_document_window_state");
}

export async function closeCurrentDocumentWindow(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("close_document_window");
}
