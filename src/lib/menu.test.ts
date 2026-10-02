import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupAppMenu } from "./menu";

const setAsAppMenu = vi.fn().mockResolvedValue(undefined);
const close = vi.fn().mockResolvedValue(undefined);
const createdMenuItems = new Map<string, ReturnType<typeof createMenuItem>>();
const createdSubmenus = new Map<string, ReturnType<typeof createSubmenu>>();
const createdSubmenusByText = new Map<string, ReturnType<typeof createSubmenu>>();

function createMenuItem(options: Record<string, unknown>) {
  return {
    ...options,
    id: options.id as string,
    text: options.text as string,
    action: options.action as (() => void) | undefined,
    setChecked: vi.fn().mockResolvedValue(undefined),
    setEnabled: vi.fn().mockResolvedValue(undefined),
    setText: vi.fn().mockResolvedValue(undefined),
  };
}

function createSubmenu(options: { items: unknown[]; text: string; id?: string }) {
  const items = [...options.items];
  return {
    ...options,
    append: vi.fn(async (item: unknown | unknown[]) => {
      if (Array.isArray(item)) {
        items.push(...item);
      } else {
        items.push(item);
      }
    }),
    items: vi.fn(async () => [...items]),
    remove: vi.fn(async (item: unknown) => {
      const index = items.indexOf(item);
      if (index >= 0) {
        items.splice(index, 1);
      }
    }),
    setEnabled: vi.fn().mockResolvedValue(undefined),
    setText: vi.fn().mockResolvedValue(undefined),
  };
}

function trackCreatedItem(options: Record<string, unknown>) {
  const id = typeof options.id === "string" ? options.id : `generated-${createdMenuItems.size}`;
  const item = createMenuItem({ ...options, id });
  createdMenuItems.set(id, item);
  return item;
}

function getCreatedItem(text: string) {
  return [...createdMenuItems.values()].find((item) => item.text === text)!;
}

function trackCreatedSubmenu(options: { items: unknown[]; text: string; id?: string }) {
  const submenu = createSubmenu(options);
  if (typeof options.id === "string") {
    createdSubmenus.set(options.id, submenu);
  }
  createdSubmenusByText.set(options.text, submenu);
  return submenu;
}

const checkMenuItemNew = vi.fn(async (options: Record<string, unknown>) => {
  const item = trackCreatedItem(options);
  return item;
});
const menuItemNew = vi.fn(async (options: Record<string, unknown>) => {
  const item = trackCreatedItem(options);
  return item;
});
const predefinedMenuItemNew = vi.fn(async (options: Record<string, unknown>) => options);
const submenuNew = vi.fn(async (options: { items: unknown[]; text: string; id?: string }) => {
  const submenu = trackCreatedSubmenu(options);
  return submenu;
});
const menuNew = vi.fn(async (options: { items: unknown[] }) => ({
  ...options,
  close,
  setAsAppMenu,
}));

vi.mock("./file-system", () => ({
  isTauriRuntime: () => true,
}));

vi.mock("@tauri-apps/api/menu", () => ({
  CheckMenuItem: { new: checkMenuItemNew },
  Menu: { new: menuNew },
  MenuItem: { new: menuItemNew },
  PredefinedMenuItem: { new: predefinedMenuItemNew },
  Submenu: { new: submenuNew },
}));

describe("setupAppMenu", () => {
  beforeEach(() => {
    checkMenuItemNew.mockClear();
    close.mockClear();
    createdMenuItems.clear();
    createdSubmenus.clear();
    createdSubmenusByText.clear();
    menuItemNew.mockClear();
    menuNew.mockClear();
    predefinedMenuItemNew.mockClear();
    setAsAppMenu.mockClear();
    submenuNew.mockClear();
  });

  it("builds the menu once and syncs its enabled state", async () => {
    const controller = await setupAppMenu({
      onClearRecentFiles: vi.fn(),
      onCopyFilePath: vi.fn(),
      onNew: vi.fn(),
      onOpen: vi.fn(),
      onOpenRecent: vi.fn(),
      onSave: vi.fn(),
      onSaveAs: vi.fn(),
      onSetThemeMode: vi.fn(),
      onToggleExternalMedia: vi.fn(),
      onTogglePreview: vi.fn(),
      onToggleToc: vi.fn(),
    });

    await controller?.sync({
      canUseEditMenu: true,
      canUseViewMenu: true,
      canCopyFilePath: true,
      canSave: true,
      canTogglePanels: true,
      isExternalMediaAutoLoadEnabled: true,
      isPreviewVisible: true,
      isTocVisible: false,
      themeMode: "dark",
      recentFiles: [
        {
          filename: "clipmark.md",
          path: "/tmp/clipmark.md",
        },
      ],
    });

    expect(setAsAppMenu).toHaveBeenCalledTimes(1);
    expect(menuNew).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ text: "ClipMark" }),
          expect.objectContaining({ text: "File" }),
          expect.objectContaining({ text: "Edit" }),
          expect.objectContaining({ text: "View" }),
          expect.objectContaining({ text: "Window" }),
        ]),
      }),
    );

    const saveItem = getCreatedItem("Save") as {
      setEnabled: ReturnType<typeof vi.fn>;
    };
    const previewItem = getCreatedItem("Preview") as {
      setChecked: ReturnType<typeof vi.fn>;
      setEnabled: ReturnType<typeof vi.fn>;
    };
    const externalMediaItem = getCreatedItem("Load External Media") as {
      setChecked: ReturnType<typeof vi.fn>;
    };
    const themeDarkItem = getCreatedItem("Dark") as {
      setChecked: ReturnType<typeof vi.fn>;
    };
    const themeSystemItem = getCreatedItem("System") as {
      setChecked: ReturnType<typeof vi.fn>;
    };

    expect(saveItem.setEnabled).toHaveBeenCalledWith(true);
    expect(externalMediaItem.setChecked).toHaveBeenCalledWith(true);
    expect(previewItem.setChecked).toHaveBeenCalledWith(true);
    expect(previewItem.setEnabled).toHaveBeenCalledWith(true);
    expect(themeDarkItem.setChecked).toHaveBeenCalledWith(true);
    expect(themeSystemItem.setChecked).toHaveBeenCalledWith(false);

    await controller?.dispose();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("disables edit and view menus when the window is unavailable", async () => {
    const controller = await setupAppMenu({
      onClearRecentFiles: vi.fn(),
      onCopyFilePath: vi.fn(),
      onNew: vi.fn(),
      onOpen: vi.fn(),
      onOpenRecent: vi.fn(),
      onSave: vi.fn(),
      onSaveAs: vi.fn(),
      onSetThemeMode: vi.fn(),
      onToggleExternalMedia: vi.fn(),
      onTogglePreview: vi.fn(),
      onToggleToc: vi.fn(),
    });

    await controller?.sync({
      canUseEditMenu: false,
      canUseViewMenu: false,
      canCopyFilePath: false,
      canSave: false,
      canTogglePanels: false,
      isExternalMediaAutoLoadEnabled: false,
      isPreviewVisible: false,
      isTocVisible: true,
      themeMode: "system",
      recentFiles: [],
    });

    const copyPathItem = getCreatedItem("Copy File Path") as {
      setEnabled: ReturnType<typeof vi.fn>;
    };
    const tocItem = getCreatedItem("Table of Contents") as {
      setChecked: ReturnType<typeof vi.fn>;
      setEnabled: ReturnType<typeof vi.fn>;
    };
    const recentSubmenu = createdSubmenusByText.get("Open Recent") as {
      setEnabled: ReturnType<typeof vi.fn>;
    };
    const editSubmenu = createdSubmenusByText.get("Edit") as {
      setEnabled: ReturnType<typeof vi.fn>;
    };
    const viewSubmenu = createdSubmenusByText.get("View") as {
      setEnabled: ReturnType<typeof vi.fn>;
    };

    expect(editSubmenu.setEnabled).toHaveBeenCalledWith(false);
    expect(viewSubmenu.setEnabled).toHaveBeenCalledWith(false);
    expect(copyPathItem.setEnabled).toHaveBeenCalledWith(false);
    expect(tocItem.setChecked).toHaveBeenCalledWith(true);
    expect(tocItem.setEnabled).toHaveBeenCalledWith(false);
    expect(recentSubmenu.setEnabled).toHaveBeenCalledWith(false);
  });

  it("does not rebuild recent files submenu when the list is unchanged", async () => {
    const controller = await setupAppMenu({
      onClearRecentFiles: vi.fn(),
      onCopyFilePath: vi.fn(),
      onNew: vi.fn(),
      onOpen: vi.fn(),
      onOpenRecent: vi.fn(),
      onSave: vi.fn(),
      onSaveAs: vi.fn(),
      onSetThemeMode: vi.fn(),
      onToggleExternalMedia: vi.fn(),
      onTogglePreview: vi.fn(),
      onToggleToc: vi.fn(),
    });

    const recentSubmenu = createdSubmenusByText.get("Open Recent") as {
      append: ReturnType<typeof vi.fn>;
      remove: ReturnType<typeof vi.fn>;
    };

    await controller?.sync({
      canUseEditMenu: true,
      canUseViewMenu: true,
      canCopyFilePath: true,
      canSave: true,
      canTogglePanels: true,
      isExternalMediaAutoLoadEnabled: true,
      isPreviewVisible: true,
      isTocVisible: true,
      themeMode: "light",
      recentFiles: [
        { filename: "clipmark.md", path: "/tmp/clipmark.md" },
      ],
    });

    recentSubmenu.append.mockClear();
    recentSubmenu.remove.mockClear();

    await controller?.sync({
      canUseEditMenu: true,
      canUseViewMenu: true,
      canCopyFilePath: true,
      canSave: true,
      canTogglePanels: true,
      isExternalMediaAutoLoadEnabled: true,
      isPreviewVisible: true,
      isTocVisible: true,
      themeMode: "light",
      recentFiles: [
        { filename: "clipmark.md", path: "/tmp/clipmark.md" },
      ],
    });

    expect(recentSubmenu.append).not.toHaveBeenCalled();
    expect(recentSubmenu.remove).not.toHaveBeenCalled();
  });

  it("invokes the requested theme handler from the app menu", async () => {
    const onSetThemeMode = vi.fn();
    await setupAppMenu({
      onClearRecentFiles: vi.fn(),
      onCopyFilePath: vi.fn(),
      onNew: vi.fn(),
      onOpen: vi.fn(),
      onOpenRecent: vi.fn(),
      onSave: vi.fn(),
      onSaveAs: vi.fn(),
      onSetThemeMode,
      onToggleExternalMedia: vi.fn(),
      onTogglePreview: vi.fn(),
      onToggleToc: vi.fn(),
    });

    const themeLightItem = getCreatedItem("Light") as unknown as {
      action: () => void;
    };

    themeLightItem.action();

    expect(onSetThemeMode).toHaveBeenCalledWith("light");
  });

  it("keeps editor callbacks alive after another window creates and closes its menu", async () => {
    const createHandlers = () => ({
      onClearRecentFiles: vi.fn(), onCopyFilePath: vi.fn(), onNew: vi.fn(),
      onOpen: vi.fn(), onOpenRecent: vi.fn(), onSave: vi.fn(), onSaveAs: vi.fn(),
      onSetThemeMode: vi.fn(), onToggleExternalMedia: vi.fn(),
      onTogglePreview: vi.fn(), onToggleToc: vi.fn(),
    });
    const state = {
      canUseEditMenu: true, canUseViewMenu: true, canCopyFilePath: true,
      canSave: true, canTogglePanels: true, isExternalMediaAutoLoadEnabled: false,
      isPreviewVisible: true, isTocVisible: true, themeMode: "system" as const,
      recentFiles: [{ filename: "note.md", path: "/tmp/note.md" }],
    };
    const editorHandlers = createHandlers();
    const previewHandlers = createHandlers();
    const editor = await setupAppMenu(editorHandlers);
    await editor?.sync(state);
    const editorItems = [...createdMenuItems.entries()];

    const preview = await setupAppMenu(previewHandlers);
    await preview?.sync(state);
    await preview?.dispose();
    await editor?.sync(state);

    for (const [id, item] of editorItems) {
      // Model Tauri's process-wide ID → callback map, rather than calling stale item references.
      expect(createdMenuItems.get(id)).toBe(item);
    }
    for (const text of ["Save", "Table of Contents", "note.md", "Clear Recent Files"]) {
      const [, item] = editorItems.find(([, value]) => value.text === text)!;
      (createdMenuItems.get(item.id as string)!.action as () => void)();
    }
    expect(editorHandlers.onSave).toHaveBeenCalledOnce();
    expect(editorHandlers.onToggleToc).toHaveBeenCalledOnce();
    expect(editorHandlers.onOpenRecent).toHaveBeenCalledWith("/tmp/note.md");
    expect(editorHandlers.onClearRecentFiles).toHaveBeenCalledOnce();
    expect(previewHandlers.onSave).not.toHaveBeenCalled();
    expect(previewHandlers.onOpenRecent).not.toHaveBeenCalled();
  });
});
