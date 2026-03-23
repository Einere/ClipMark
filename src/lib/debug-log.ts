import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./file-system";

function formatMessage(message: string) {
  return `[${new Date().toISOString()}] ${message}`;
}

export async function clearDebugLog() {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("clear_debug_log");
}

export function logDebug(message: string) {
  const line = formatMessage(message);
  console.log(line);

  if (!isTauriRuntime()) {
    return;
  }

  void invoke("append_debug_log", { line });
}
