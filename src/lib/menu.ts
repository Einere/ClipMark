import { isTauriRuntime } from "./file-system";

type MenuHandlers = {
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onTogglePreview: () => void;
  onToggleToc: () => void;
};

export async function setupAppMenu(
  handlers: MenuHandlers,
): Promise<(() => Promise<void>) | undefined> {
  if (!isTauriRuntime()) {
    return undefined;
  }

  const { Menu, MenuItem, PredefinedMenuItem, Submenu } = await import(
    "@tauri-apps/api/menu"
  );

  const appSubmenu = await Submenu.new({
    text: "ClipMark",
    items: [
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
        id: "file-save",
        text: "Save",
      }),
      await MenuItem.new({
        accelerator: "CmdOrCtrl+Shift+S",
        action: () => handlers.onSaveAs(),
        id: "file-save-as",
        text: "Save As...",
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
      await MenuItem.new({
        accelerator: "Alt+CmdOrCtrl+P",
        action: () => handlers.onTogglePreview(),
        id: "view-toggle-preview",
        text: "Toggle Preview",
      }),
      await MenuItem.new({
        accelerator: "Alt+CmdOrCtrl+T",
        action: () => handlers.onToggleToc(),
        id: "view-toggle-toc",
        text: "Toggle Table of Contents",
      }),
    ],
  });

  const menu = await Menu.new({
    items: [appSubmenu, fileSubmenu, editSubmenu, viewSubmenu],
  });

  await menu.setAsAppMenu();

  return async () => {
    await menu.close();
  };
}
