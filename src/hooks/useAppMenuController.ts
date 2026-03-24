import { useEffect, useRef, useState } from "react";
import type { MenuHandlers, MenuState } from "../lib/menu";
import { setupAppMenu } from "../lib/menu";

export function useAppMenuController(
  handlers: MenuHandlers,
  state: MenuState,
) {
  const handlersRef = useRef(handlers);
  const [menuController, setMenuController] = useState<Awaited<ReturnType<typeof setupAppMenu>>>();

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const menuHandlersRef = useRef<MenuHandlers | null>(null);
  if (menuHandlersRef.current === null) {
    menuHandlersRef.current = {
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
  const stableMenuHandlers = menuHandlersRef.current;

  useEffect(() => {
    let disposed = false;
    let controller: Awaited<ReturnType<typeof setupAppMenu>>;

    void setupAppMenu(stableMenuHandlers).then((nextController) => {
      if (disposed) {
        void nextController?.dispose();
        return;
      }

      controller = nextController;
      setMenuController(nextController);
    });

    return () => {
      disposed = true;
      setMenuController(undefined);
      if (controller) {
        void controller.dispose();
      }
    };
  }, [stableMenuHandlers]);

  useEffect(() => {
    if (!menuController) {
      return;
    }

    void menuController.sync(state);
  }, [menuController, state]);
}
