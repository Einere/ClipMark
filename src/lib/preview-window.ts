import { invoke } from "@tauri-apps/api/core";
import type { PreviewConnection, PreviewSnapshot } from "./preview-window-state";

export const togglePreviewWindow = () => invoke<PreviewConnection | null>("toggle_preview_window");
export const getPreviewConnection = () => invoke<PreviewConnection | null>("get_preview_connection");
export const publishPreviewSnapshot = (snapshot: PreviewSnapshot) => invoke("publish_preview_snapshot", { snapshot });
export const requestPreviewState = () => invoke("preview_ready");
export const routePreviewAction = (action: string, value?: string) => invoke("preview_document_action", { action, value: value ?? null });
