import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupAppMenu } from "./menu";

const checkMenuItemNew = vi.fn(async (options: Record<string, unknown>) => options);
const setAsAppMenu = vi.fn().mockResolvedValue(undefined);
const close = vi.fn().mockResolvedValue(undefined);
const menuNew = vi.fn(async (options: { items: unknown[] }) => ({
  ...options,
  close,
  setAsAppMenu,
}));
const submenuNew = vi.fn(async (options: { items: unknown[]; text: string }) => options);
const menuItemNew = vi.fn(async (options: Record<string, unknown>) => options);
const predefinedMenuItemNew = vi.fn(async (options: Record<string, unknown>) => options);

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
    menuItemNew.mockClear();
    menuNew.mockClear();
    predefinedMenuItemNew.mockClear();
    setAsAppMenu.mockClear();
    submenuNew.mockClear();
  });

  it("builds a macOS app menu with file path and window actions", async () => {
    const dispose = await setupAppMenu({
      filePath: "/tmp/clipmark.md",
      isPreviewVisible: true,
      isTocVisible: false,
      onClearRecentFiles: vi.fn(),
      onCopyFilePath: vi.fn(),
      onNew: vi.fn(),
      onOpen: vi.fn(),
      onOpenRecent: vi.fn(),
      onSave: vi.fn(),
      onSaveAs: vi.fn(),
      onTogglePreview: vi.fn(),
      onToggleToc: vi.fn(),
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

    expect(predefinedMenuItemNew).toHaveBeenCalledWith({
      item: { About: null },
    });
    expect(menuItemNew).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        id: "file-copy-path",
        text: "Copy File Path",
      }),
    );
    expect(checkMenuItemNew).toHaveBeenCalledWith(
      expect.objectContaining({
        checked: true,
        id: "view-toggle-preview",
        text: "Preview",
      }),
    );
    expect(checkMenuItemNew).toHaveBeenCalledWith(
      expect.objectContaining({
        checked: false,
        id: "view-toggle-toc",
        text: "Table of Contents",
      }),
    );
    expect(menuItemNew).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "file-open-recent-clear",
        text: "Clear Recent Files",
      }),
    );
    expect(predefinedMenuItemNew).toHaveBeenCalledWith({
      item: "Fullscreen",
    });
    expect(predefinedMenuItemNew).toHaveBeenCalledWith({
      item: "Minimize",
    });
    expect(predefinedMenuItemNew).toHaveBeenCalledWith({
      item: "Maximize",
    });

    await dispose?.();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("disables file path copy and open recent when unavailable", async () => {
    await setupAppMenu({
      filePath: null,
      isPreviewVisible: false,
      isTocVisible: true,
      onClearRecentFiles: vi.fn(),
      onCopyFilePath: vi.fn(),
      onNew: vi.fn(),
      onOpen: vi.fn(),
      onOpenRecent: vi.fn(),
      onSave: vi.fn(),
      onSaveAs: vi.fn(),
      onTogglePreview: vi.fn(),
      onToggleToc: vi.fn(),
      recentFiles: [],
    });

    expect(menuItemNew).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
        id: "file-copy-path",
      }),
    );
    expect(menuItemNew).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
        id: "file-open-recent-empty",
      }),
    );
    expect(checkMenuItemNew).toHaveBeenCalledWith(
      expect.objectContaining({
        checked: false,
        id: "view-toggle-preview",
        text: "Preview",
      }),
    );
    expect(checkMenuItemNew).toHaveBeenCalledWith(
      expect.objectContaining({
        checked: true,
        id: "view-toggle-toc",
        text: "Table of Contents",
      }),
    );
  });
});
