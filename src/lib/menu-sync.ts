import type { MenuItem } from "@tauri-apps/api/menu/menuItem";
import type { Submenu } from "@tauri-apps/api/menu/submenu";
import type { MenuHandlers, MenuState } from "./menu";
import type { RecentFile } from "./recent-files";

type CheckableMenuItem = {
  setChecked: (checked: boolean) => Promise<void>;
  setEnabled?: (enabled: boolean) => Promise<void>;
};

type EnableableMenuItem = {
  setEnabled: (enabled: boolean) => Promise<void>;
};

export type AppMenuSyncContext = {
  copyPathItem: EnableableMenuItem;
  createMenuItem: (options: Parameters<typeof import("@tauri-apps/api/menu").MenuItem.new>[0]) => Promise<MenuItem>;
  createSeparator: () => Promise<Awaited<ReturnType<typeof import("@tauri-apps/api/menu").PredefinedMenuItem.new>>>;
  editSubmenu: { setEnabled: (enabled: boolean) => Promise<void> };
  externalMediaItem: CheckableMenuItem;
  handlers: MenuHandlers;
  previewItem: CheckableMenuItem & EnableableMenuItem;
  recentSubmenu: Submenu;
  saveAsItem: EnableableMenuItem;
  saveItem: EnableableMenuItem;
  themeDarkItem: CheckableMenuItem;
  themeLightItem: CheckableMenuItem;
  themeSystemItem: CheckableMenuItem;
  tocItem: CheckableMenuItem & EnableableMenuItem;
  viewSubmenu: { setEnabled: (enabled: boolean) => Promise<void> };
};

export function cloneMenuState(state: MenuState): MenuState {
  return {
    ...state,
    recentFiles: state.recentFiles.map((file) => ({ ...file })),
  };
}

export function areRecentFilesEqual(left: RecentFile[], right: RecentFile[]) {
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

export async function syncAppMenuState({
  context,
  lastState,
  state,
}: {
  context: AppMenuSyncContext;
  lastState: MenuState | null;
  state: MenuState;
}) {
  const updates: Promise<void>[] = [];

  if (!lastState || lastState.canUseEditMenu !== state.canUseEditMenu) {
    updates.push(context.editSubmenu.setEnabled(state.canUseEditMenu));
  }

  if (!lastState || lastState.canUseViewMenu !== state.canUseViewMenu) {
    updates.push(context.viewSubmenu.setEnabled(state.canUseViewMenu));
  }

  if (!lastState || lastState.canSave !== state.canSave) {
    updates.push(context.saveItem.setEnabled(state.canSave));
    updates.push(context.saveAsItem.setEnabled(state.canSave));
  }

  if (!lastState || lastState.canCopyFilePath !== state.canCopyFilePath) {
    updates.push(context.copyPathItem.setEnabled(state.canCopyFilePath));
  }

  if (!lastState || lastState.canTogglePanels !== state.canTogglePanels) {
    updates.push(context.previewItem.setEnabled(state.canTogglePanels));
    updates.push(context.tocItem.setEnabled(state.canTogglePanels));
  }

  if (
    !lastState
    || lastState.isExternalMediaAutoLoadEnabled !== state.isExternalMediaAutoLoadEnabled
  ) {
    updates.push(context.externalMediaItem.setChecked(state.isExternalMediaAutoLoadEnabled));
  }

  if (!lastState || lastState.isPreviewVisible !== state.isPreviewVisible) {
    updates.push(context.previewItem.setChecked(state.isPreviewVisible));
  }

  if (!lastState || lastState.isTocVisible !== state.isTocVisible) {
    updates.push(context.tocItem.setChecked(state.isTocVisible));
  }

  if (!lastState || lastState.themeMode !== state.themeMode) {
    updates.push(context.themeSystemItem.setChecked(state.themeMode === "system"));
    updates.push(context.themeLightItem.setChecked(state.themeMode === "light"));
    updates.push(context.themeDarkItem.setChecked(state.themeMode === "dark"));
  }

  await Promise.all(updates);

  if (!lastState || !areRecentFilesEqual(lastState.recentFiles, state.recentFiles)) {
    await syncRecentFilesMenu({
      createMenuItem: context.createMenuItem,
      createSeparator: context.createSeparator,
      handlers: context.handlers,
      recentFiles: state.recentFiles,
      recentSubmenu: context.recentSubmenu,
    });
  }

  return cloneMenuState(state);
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
