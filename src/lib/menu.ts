import { syncAppMenuState } from "./menu-sync";
import type { ThemeMode } from "./preview-preferences";
import type { RecentFile } from "./recent-files";
import { isTauriRuntime } from "./file-system";

export type MenuHandlers = {
  onNew: () => void;
  onOpen: () => void;
  onOpenRecent: (path: string) => void;
  onClearRecentFiles: () => void;
  onCopyFilePath: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onSetThemeMode: (themeMode: ThemeMode) => void;
  onToggleExternalMedia: () => void;
  onTogglePreview: () => void;
  onToggleToc: () => void;
};

export type MenuState = {
  canUseEditMenu: boolean;
  canUseViewMenu: boolean;
  canCopyFilePath: boolean;
  canSave: boolean;
  canTogglePanels: boolean;
  isExternalMediaAutoLoadEnabled: boolean;
  isPreviewVisible: boolean;
  isTocVisible: boolean;
  themeMode: ThemeMode;
  recentFiles: RecentFile[];
};

export type AppMenuController = {
  dispose: () => Promise<void>;
  sync: (state: MenuState) => Promise<void>;
};

export async function setupAppMenu(
  handlers: MenuHandlers,
): Promise<AppMenuController | undefined> {
  if (!isTauriRuntime()) {
    return undefined;
  }

  const { CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu } =
    await import("@tauri-apps/api/menu");

  const recentSubmenu = await Submenu.new({
    id: "file-open-recent",
    items: [],
    text: "Open Recent",
  });

  const saveItem = await MenuItem.new({
    accelerator: "CmdOrCtrl+S",
    action: () => handlers.onSave(),
    id: "file-save",
    text: "Save",
  });

  const saveAsItem = await MenuItem.new({
    accelerator: "CmdOrCtrl+Shift+S",
    action: () => handlers.onSaveAs(),
    id: "file-save-as",
    text: "Save As...",
  });

  const copyPathItem = await MenuItem.new({
    accelerator: "Alt+CmdOrCtrl+C",
    action: () => handlers.onCopyFilePath(),
    id: "file-copy-path",
    text: "Copy File Path",
  });

  const previewItem = await CheckMenuItem.new({
    accelerator: "Alt+CmdOrCtrl+P",
    action: () => handlers.onTogglePreview(),
    id: "view-toggle-preview",
    text: "Preview",
  });

  const tocItem = await CheckMenuItem.new({
    accelerator: "Alt+CmdOrCtrl+T",
    action: () => handlers.onToggleToc(),
    id: "view-toggle-toc",
    text: "Table of Contents",
  });

  const externalMediaItem = await CheckMenuItem.new({
    action: () => handlers.onToggleExternalMedia(),
    id: "view-toggle-external-media",
    text: "Load External Media",
  });

  const themeSystemItem = await CheckMenuItem.new({
    action: () => handlers.onSetThemeMode("system"),
    id: "app-theme-system",
    text: "System",
  });

  const themeLightItem = await CheckMenuItem.new({
    action: () => handlers.onSetThemeMode("light"),
    id: "app-theme-light",
    text: "Light",
  });

  const themeDarkItem = await CheckMenuItem.new({
    action: () => handlers.onSetThemeMode("dark"),
    id: "app-theme-dark",
    text: "Dark",
  });

  const themeSubmenu = await Submenu.new({
    text: "Theme",
    items: [themeSystemItem, themeLightItem, themeDarkItem],
  });

  const appSubmenu = await Submenu.new({
    text: "ClipMark",
    items: [
      await PredefinedMenuItem.new({ item: { About: null } }),
      await PredefinedMenuItem.new({ item: "Separator" }),
      themeSubmenu,
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
      saveItem,
      saveAsItem,
      recentSubmenu,
      await PredefinedMenuItem.new({ item: "Separator" }),
      copyPathItem,
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
      previewItem,
      tocItem,
      externalMediaItem,
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

  let lastState: MenuState | null = null;

  return {
    async dispose() {
      await menu.close();
    },
    async sync(state) {
      lastState = await syncAppMenuState({
        context: {
          copyPathItem,
          createMenuItem: MenuItem.new,
          createSeparator: () => PredefinedMenuItem.new({ item: "Separator" }),
          editSubmenu,
          externalMediaItem,
          handlers,
          previewItem,
          recentSubmenu,
          saveAsItem,
          saveItem,
          themeDarkItem,
          themeLightItem,
          themeSystemItem,
          tocItem,
          viewSubmenu,
        },
        lastState,
        state,
      });
    },
  };
}
