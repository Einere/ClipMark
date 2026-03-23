import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./file-system";

export async function hideNativeWindow() {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("hide_window");
}

export async function showNativeWindow() {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("show_window");
}
