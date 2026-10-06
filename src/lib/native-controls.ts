import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauriRuntime } from "./file-system";

export type NativeControlAction = "copy-path" | "toggle-preview";

export async function syncNativeControls(state: { path: string | null; previewOpen: boolean; pathCopied?: boolean }) {
  if (!isTauriRuntime()) return false;
  return invoke<boolean>("sync_native_controls", state);
}

export async function listenNativeControlAction(handler: (action: NativeControlAction) => void) {
  if (!isTauriRuntime()) return () => {};
  return getCurrentWindow().listen<string>("native-control-action", ({ payload }) => {
    if (payload === "copy-path" || payload === "toggle-preview") handler(payload);
  });
}
