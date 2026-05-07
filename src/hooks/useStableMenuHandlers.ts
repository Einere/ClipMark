import { useEffect, useRef } from "react";
import type { MenuHandlers } from "../lib/menu";

export function useStableMenuHandlers(handlers: MenuHandlers): MenuHandlers {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const stableHandlersRef = useRef<MenuHandlers | null>(null);
  if (stableHandlersRef.current === null) {
    stableHandlersRef.current = {
      onClearRecentFiles: () => handlersRef.current.onClearRecentFiles(),
      onCopyFilePath: () => handlersRef.current.onCopyFilePath(),
      onNew: () => handlersRef.current.onNew(),
      onOpen: () => handlersRef.current.onOpen(),
      onOpenRecent: (path) => handlersRef.current.onOpenRecent(path),
      onSave: () => handlersRef.current.onSave(),
      onSaveAs: () => handlersRef.current.onSaveAs(),
      onSetThemeMode: (themeMode) => handlersRef.current.onSetThemeMode(themeMode),
      onToggleExternalMedia: () => handlersRef.current.onToggleExternalMedia(),
      onTogglePreview: () => handlersRef.current.onTogglePreview(),
      onToggleToc: () => handlersRef.current.onToggleToc(),
    };
  }

  return stableHandlersRef.current;
}
