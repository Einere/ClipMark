import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { MarkdownPreview } from "./MarkdownPreview";
import { getPreviewConnection, requestPreviewState, routePreviewAction } from "../../lib/preview-window";
import { acceptPreviewSnapshot, type PreviewConnection, type PreviewSnapshot } from "../../lib/preview-window-state";
import { applyTheme, subscribeToSystemTheme } from "../../lib/theme";
import { useAppMenuController } from "../../hooks/useAppMenuController";
import type { MenuState } from "../../lib/menu";

export function PreviewWindow() {
  const [snapshot, setSnapshot] = useState<PreviewSnapshot | null>(null);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState(false);
  const current = useRef<PreviewSnapshot | null>(null);
  const route = (action: string, value?: string) => { void routePreviewAction(action, value).catch((reason) => setError(String(reason))); };
  const menuState: MenuState = snapshot?.menuState ?? {
    canUseEditMenu: false, canUseViewMenu: false, canCopyFilePath: false, canSave: false,
    canTogglePanels: false, isExternalMediaAutoLoadEnabled: false, isPreviewVisible: true,
    isTocVisible: false, themeMode: "system", recentFiles: [],
  };
  useAppMenuController({
    onNew: () => route("new"), onOpen: () => route("open"), onOpenRecent: (path) => route("open-recent", path),
    onClearRecentFiles: () => route("clear-recent"), onSave: () => route("save"), onSaveAs: () => route("save-as"),
    onCopyFilePath: () => route("copy-path"), onTogglePreview: () => route("toggle-preview"), onToggleToc: () => route("toggle-toc"),
    onSetThemeMode: (mode) => route("set-theme-mode", mode), onToggleExternalMedia: () => route("toggle-external-media"),
  }, menuState, focused);
  useEffect(() => {
    let disposed = false; let cleanup: (() => void) | undefined;
    void getCurrentWindow().onFocusChanged(({ payload }) => setFocused(payload)).then((unlisten) => {
      if (disposed) unlisten(); else cleanup = unlisten;
    }).catch((reason) => { if (!disposed) setError(String(reason)); });
    void getCurrentWindow().isFocused().then((value) => { if (!disposed) setFocused(value); })
      .catch((reason) => { if (!disposed) setError(String(reason)); });
    return () => { disposed = true; cleanup?.(); };
  }, []);
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    let connection: PreviewConnection | null = null;
    void (async () => {
      connection = await getPreviewConnection();
      if (!connection || disposed) return;
      const unlisten = await getCurrentWindow().listen<PreviewSnapshot>("preview-snapshot", ({ payload }) => {
        if (payload.ownerLabel !== connection?.ownerLabel || payload.connectionId !== connection.connectionId) return;
        if (current.current && !acceptPreviewSnapshot(current.current, payload)) return;
        current.current = payload;
        setSnapshot(payload); setError("");
      });
      if (disposed) { unlisten(); return; }
      cleanup = unlisten;
      await requestPreviewState();
    })().catch((reason) => { if (!disposed) setError(String(reason)); });
    return () => { disposed = true; cleanup?.(); };
  }, []);
  useEffect(() => {
    if (!snapshot) return;
    applyTheme(snapshot.themeMode);
    void getCurrentWindow().setTitle(`${snapshot.filename} · Preview`).catch((reason) => setError(String(reason)));
    if (snapshot.themeMode === "system") return subscribeToSystemTheme(() => applyTheme("system"));
  }, [snapshot?.themeMode, snapshot?.filename]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey) return;
      const key = event.key.toLowerCase();
      const action = event.altKey ? ({ p: "toggle-preview", c: "copy-path", t: "toggle-toc" } as Record<string,string>)[key]
        : ({ s: event.shiftKey ? "save-as" : "save", n: "new", o: "open" } as Record<string,string>)[key];
      if (action) { event.preventDefault(); void routePreviewAction(action).catch((reason) => setError(String(reason))); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return <main className="preview-window">
    {error ? <p role="alert">Preview disconnected: {error}</p> : null}
    {snapshot ? <MarkdownPreview markdown={snapshot.markdown} activeLine={snapshot.activeLine}
      editSequence={snapshot.editSequence} filePath={snapshot.filePath}
      isAutoScrollEnabled={true} isExternalMediaAutoLoadEnabled={snapshot.autoLoadExternalMedia} />
      : <p role="status">Connecting preview…</p>}
  </main>;
}
