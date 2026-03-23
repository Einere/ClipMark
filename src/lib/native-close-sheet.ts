import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./file-system";

export type NativeCloseSheetResult =
  | "cancel"
  | "discard"
  | "save"
  | "unsupported";

function isNativeCloseSheetResult(
  value: string,
): value is Exclude<NativeCloseSheetResult, "unsupported"> {
  return value === "cancel" || value === "discard" || value === "save";
}

export async function showNativeCloseSheet(
  filename: string,
): Promise<NativeCloseSheetResult> {
  if (!isTauriRuntime()) {
    return "unsupported";
  }

  try {
    const result = await invoke<string>("show_unsaved_changes_sheet", {
      filename,
    });

    return isNativeCloseSheetResult(result) ? result : "unsupported";
  } catch {
    return "unsupported";
  }
}
