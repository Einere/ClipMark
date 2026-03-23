import type { RecentFile } from "./recent-files";
import { isTauriRuntime } from "./file-system";

type MenuHandlers = {
  canCopyFilePath: boolean;
  canSave: boolean;
  canTogglePanels: boolean;
  onNew: () => void;
  onOpen: () => void;
  onOpenRecent: (path: string) => void;
  onClearRecentFiles: () => void;
  onCopyFilePath: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onTogglePreview: () => void;
  onToggleToc: () => void;
  filePath: string | null;
  isPreviewVisible: boolean;
  isTocVisible: boolean;
  recentFiles: RecentFile[];
};

export async function setupAppMenu(
  handlers: MenuHandlers,
): Promise<(() => Promise<void>) | undefined> {
  if (!isTauriRuntime()) {
    return undefined;
  }

  const { CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu } =
    await import("@tauri-apps/api/menu");

  const appSubmenu = await Submenu.new({
    text: "ClipMark",
    items: [
      await PredefinedMenuItem.new({ item: { About: null } }),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await PredefinedMenuItem.new({ item: "Services" }),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await PredefinedMenuItem.new({ item: "Hide" }),
      await PredefinedMenuItem.new({ item: "HideOthers" }),
      await PredefinedMenuItem.new({ item: "ShowAll" }),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await PredefinedMenuItem.new({ item: "Quit" }),
    ],
  });

  const fileSubmenu = await Submenu.new({
    text: "File",
    items: [
      await MenuItem.new({
        accelerator: "CmdOrCtrl+N",
        action: () => handlers.onNew(),
        id: "file-new",
        text: "New",
      }),
      await MenuItem.new({
        accelerator: "CmdOrCtrl+O",
        action: () => handlers.onOpen(),
        id: "file-open",
        text: "Open...",
      }),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await MenuItem.new({
        accelerator: "CmdOrCtrl+S",
        action: () => handlers.onSave(),
        enabled: handlers.canSave,
        id: "file-save",
        text: "Save",
      }),
      await MenuItem.new({
        accelerator: "CmdOrCtrl+Shift+S",
        action: () => handlers.onSaveAs(),
        enabled: handlers.canSave,
        id: "file-save-as",
        text: "Save As...",
      }),
      await (
        handlers.recentFiles.length > 0
          ? Submenu.new({
              text: "Open Recent",
              items: [
                ...(await Promise.all(
                  handlers.recentFiles.map((file) =>
                    MenuItem.new({
                      action: () => handlers.onOpenRecent(file.path),
                      id: `recent-${file.path}`,
                      text: file.filename,
                    }),
                  ),
                )),
                await PredefinedMenuItem.new({ item: "Separator" }),
                await MenuItem.new({
                  action: () => handlers.onClearRecentFiles(),
                  id: "file-open-recent-clear",
                  text: "Clear Recent Files",
                }),
              ],
            })
          : MenuItem.new({
              enabled: false,
              id: "file-open-recent-empty",
              text: "Open Recent",
            })
      ),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await MenuItem.new({
        accelerator: "Alt+CmdOrCtrl+C",
        action: () => handlers.onCopyFilePath(),
        enabled: handlers.canCopyFilePath,
        id: "file-copy-path",
        text: "Copy File Path",
      }),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await PredefinedMenuItem.new({ item: "CloseWindow" }),
    ],
  });

  const editSubmenu = await Submenu.new({
    text: "Edit",
    items: [
      await PredefinedMenuItem.new({ item: "Undo" }),
      await PredefinedMenuItem.new({ item: "Redo" }),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await PredefinedMenuItem.new({ item: "Cut" }),
      await PredefinedMenuItem.new({ item: "Copy" }),
      await PredefinedMenuItem.new({ item: "Paste" }),
      await PredefinedMenuItem.new({ item: "SelectAll" }),
    ],
  });

  const viewSubmenu = await Submenu.new({
    text: "View",
    items: [
      await CheckMenuItem.new({
        accelerator: "Alt+CmdOrCtrl+P",
        action: () => handlers.onTogglePreview(),
        checked: handlers.isPreviewVisible,
        enabled: handlers.canTogglePanels,
        id: "view-toggle-preview",
        text: "Preview",
      }),
      await CheckMenuItem.new({
        accelerator: "Alt+CmdOrCtrl+T",
        action: () => handlers.onToggleToc(),
        checked: handlers.isTocVisible,
        enabled: handlers.canTogglePanels,
        id: "view-toggle-toc",
        text: "Table of Contents",
      }),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await PredefinedMenuItem.new({ item: "Fullscreen" }),
    ],
  });

  const windowSubmenu = await Submenu.new({
    text: "Window",
    items: [
      await PredefinedMenuItem.new({ item: "Minimize" }),
      await PredefinedMenuItem.new({ item: "Maximize" }),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await PredefinedMenuItem.new({ item: "CloseWindow" }),
    ],
  });

  const menu = await Menu.new({
    items: [appSubmenu, fileSubmenu, editSubmenu, viewSubmenu, windowSubmenu],
  });

  await menu.setAsAppMenu();

  return async () => {
    await menu.close();
  };
}
