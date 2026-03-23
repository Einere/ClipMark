import type { MenuItem } from "@tauri-apps/api/menu/menuItem";
import type { Submenu } from "@tauri-apps/api/menu/submenu";
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
      const updates: Promise<void>[] = [];

      if (!lastState || lastState.canUseEditMenu !== state.canUseEditMenu) {
        updates.push(editSubmenu.setEnabled(state.canUseEditMenu));
      }

      if (!lastState || lastState.canUseViewMenu !== state.canUseViewMenu) {
        updates.push(viewSubmenu.setEnabled(state.canUseViewMenu));
      }

      if (!lastState || lastState.canSave !== state.canSave) {
        updates.push(saveItem.setEnabled(state.canSave));
        updates.push(saveAsItem.setEnabled(state.canSave));
      }

      if (!lastState || lastState.canCopyFilePath !== state.canCopyFilePath) {
        updates.push(copyPathItem.setEnabled(state.canCopyFilePath));
      }

      if (!lastState || lastState.canTogglePanels !== state.canTogglePanels) {
        updates.push(previewItem.setEnabled(state.canTogglePanels));
        updates.push(tocItem.setEnabled(state.canTogglePanels));
      }

      if (
        !lastState
        || lastState.isExternalMediaAutoLoadEnabled !== state.isExternalMediaAutoLoadEnabled
      ) {
        updates.push(externalMediaItem.setChecked(state.isExternalMediaAutoLoadEnabled));
      }

      if (!lastState || lastState.isPreviewVisible !== state.isPreviewVisible) {
        updates.push(previewItem.setChecked(state.isPreviewVisible));
      }

      if (!lastState || lastState.isTocVisible !== state.isTocVisible) {
        updates.push(tocItem.setChecked(state.isTocVisible));
      }

      await Promise.all(updates);

      if (
        !lastState
        || !areRecentFilesEqual(lastState.recentFiles, state.recentFiles)
      ) {
        await syncRecentFilesMenu({
          createMenuItem: MenuItem.new,
          createSeparator: () => PredefinedMenuItem.new({ item: "Separator" }),
          handlers,
          recentFiles: state.recentFiles,
          recentSubmenu,
        });
      }

      lastState = {
        ...state,
        recentFiles: state.recentFiles.map((file) => ({ ...file })),
      };
    },
  };
}

function areRecentFilesEqual(left: RecentFile[], right: RecentFile[]) {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (
      left[index]?.path !== right[index]?.path
      || left[index]?.filename !== right[index]?.filename
    ) {
      return false;
    }
  }

  return true;
}

async function syncRecentFilesMenu({
  createMenuItem,
  createSeparator,
  handlers,
  recentFiles,
  recentSubmenu,
}: {
  createMenuItem: (options: Parameters<typeof import("@tauri-apps/api/menu").MenuItem.new>[0]) => Promise<MenuItem>;
  createSeparator: () => Promise<Awaited<ReturnType<typeof import("@tauri-apps/api/menu").PredefinedMenuItem.new>>>;
  handlers: MenuHandlers;
  recentFiles: RecentFile[];
  recentSubmenu: Submenu;
}) {
  const existingItems = await recentSubmenu.items();
  for (const item of existingItems) {
    await recentSubmenu.remove(item);
  }

  await recentSubmenu.setEnabled(recentFiles.length > 0);

  if (recentFiles.length === 0) {
    await recentSubmenu.append(
      await createMenuItem({
        enabled: false,
        id: "file-open-recent-empty",
        text: "No Recent Files",
      }),
    );
    return;
  }

  const recentItems: MenuItem[] = [];
  for (const file of recentFiles) {
    recentItems.push(await createMenuItem({
      action: () => handlers.onOpenRecent(file.path),
      id: `recent-${file.path}`,
      text: file.filename,
    }));
  }

  await recentSubmenu.append(recentItems);
  await recentSubmenu.append(await createSeparator());
  await recentSubmenu.append(
    await createMenuItem({
      action: () => handlers.onClearRecentFiles(),
      id: "file-open-recent-clear",
      text: "Clear Recent Files",
    }),
  );
}
