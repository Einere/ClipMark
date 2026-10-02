import { useEffect, useEffectEvent, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauriRuntime } from "../lib/file-system";
import type { DocumentStore } from "../lib/document-store";
import type { ThemeMode } from "../lib/preview-preferences";
import type { PreviewConnection } from "../lib/preview-window-state";
import { publishPreviewSnapshot, togglePreviewWindow } from "../lib/preview-window";
import type { RecentFile } from "../lib/recent-files";

export function usePreviewWindow(options: {
  documentStore: DocumentStore; filePath: string | null; filename: string;
  themeMode: ThemeMode; autoLoadExternalMedia: boolean;
  isTocVisible: boolean; recentFiles: RecentFile[]; canSave: boolean;
  onError: (message: string) => void;
}) {
  const [connection, setConnection] = useState<PreviewConnection | null>(null);
  const connectionRef = useRef<PreviewConnection | null>(null);
  const activity = useRef({ activeLine: 1 as number | null, editSequence: 0 });
  const sequence = useRef(0);
  const content = useRef({ revision: -1, markdown: "" });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const toggling = useRef<Promise<void>>(Promise.resolve());
  const sendSnapshot = useEffectEvent(() => {
    const current = connectionRef.current;
    if (!current) return;
    const revision = options.documentStore.getRevision();
    if (content.current.revision !== revision) {
      content.current = { revision, markdown: options.documentStore.getMarkdown() };
    }
    void publishPreviewSnapshot({ ...current, ...activity.current,
      sequence: ++sequence.current, documentRevision: revision, markdown: content.current.markdown,
      filePath: options.filePath, filename: options.filename, themeMode: options.themeMode,
      autoLoadExternalMedia: options.autoLoadExternalMedia,
      menuState: { canUseEditMenu: false, canUseViewMenu: true, canCopyFilePath: !!options.filePath,
        canSave: options.canSave, canTogglePanels: true, isExternalMediaAutoLoadEnabled: options.autoLoadExternalMedia,
        isPreviewVisible: true, isTocVisible: options.isTocVisible, themeMode: options.themeMode, recentFiles: options.recentFiles },
    }).catch(() => {
      if (connectionRef.current?.connectionId === current.connectionId) options.onError("Could not update preview.");
    });
  });
  const onEditorActivity = useEffectEvent((activeLine: number | null, editSequence: number) => {
    activity.current = { activeLine, editSequence };
    if (!connectionRef.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(sendSnapshot, 120);
  });
  const toggle = useEffectEvent(() => {
    // Serializing toggles prevents duplicate children while window creation is pending.
    toggling.current = toggling.current.then(async () => {
      const next = await togglePreviewWindow();
      connectionRef.current = next;
      setConnection(next);
    }).catch((error) => options.onError(String(error)));
    return toggling.current;
  });

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let disposed = false;
    const cleanups: (() => void)[] = [];
    const window = getCurrentWindow();
    for (const promise of [
      window.listen<PreviewConnection>("preview-ready", ({ payload }) => {
        if (connectionRef.current?.connectionId === payload.connectionId) sendSnapshot();
      }),
      window.listen<PreviewConnection>("preview-closed", ({ payload }) => {
        if (connectionRef.current?.connectionId === payload.connectionId) {
          connectionRef.current = null; setConnection(null);
        }
      }),
    ]) {
      void promise.then((cleanup) => { if (disposed) cleanup(); else cleanups.push(cleanup); })
        .catch((error) => options.onError(String(error)));
    }
    return () => { disposed = true; cleanups.forEach((cleanup) => cleanup()); clearTimeout(timer.current); };
  }, []);

  useEffect(() => {
    if (!connection) return;
    sendSnapshot();
    return options.documentStore.subscribe(() => {
      clearTimeout(timer.current); timer.current = setTimeout(sendSnapshot, 120);
    });
  }, [connection, options.documentStore]);

  useEffect(() => { sendSnapshot(); }, [options.filePath, options.filename, options.themeMode, options.autoLoadExternalMedia, options.isTocVisible, options.recentFiles, options.canSave]);
  return { isOpen: connection !== null, toggle, onEditorActivity };
}
