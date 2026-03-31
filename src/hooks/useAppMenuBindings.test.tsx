import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppMenuBindings } from "./useAppMenuBindings";

type Controls = ReturnType<typeof useAppMenuBindings>;

function Harness({
  onReady,
}: {
  onReady: (controls: Controls) => void;
}) {
  const controls = useAppMenuBindings({
    canCopyFilePath: true,
    canSave: true,
    canTogglePanels: true,
    canUseEditMenu: true,
    canUseViewMenu: false,
    isExternalMediaAutoLoadEnabled: true,
    isPreviewVisible: true,
    isTocVisible: false,
    onClearRecentFiles: vi.fn(),
    onCopyFilePath: vi.fn(),
    onNew: vi.fn(),
    onOpen: vi.fn(),
    onOpenRecent: vi.fn(),
    onSave: vi.fn(),
    onSetThemeMode: vi.fn(),
    onToggleExternalMedia: vi.fn(),
    onTogglePreview: vi.fn(),
    onToggleToc: vi.fn(),
    recentFiles: [{ filename: "note.md", path: "/tmp/note.md" }],
    themeMode: "dark",
  });

  onReady(controls);
  return null;
}

describe("useAppMenuBindings", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let controls: Controls;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("exposes the menu state snapshot used by the app menu controller", async () => {
    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
      }));
    });

    expect(controls.menuState).toEqual({
      canCopyFilePath: true,
      canSave: true,
      canTogglePanels: true,
      canUseEditMenu: true,
      canUseViewMenu: false,
      isExternalMediaAutoLoadEnabled: true,
      isPreviewVisible: true,
      isTocVisible: false,
      recentFiles: [{ filename: "note.md", path: "/tmp/note.md" }],
      themeMode: "dark",
    });
  });

  it("wraps save handlers so the controller can trigger save and save as separately", async () => {
    const onSave = vi.fn();

    function SaveHarness({
      onReady,
    }: {
      onReady: (controls: Controls) => void;
    }) {
      const nextControls = useAppMenuBindings({
        canCopyFilePath: false,
        canSave: true,
        canTogglePanels: false,
        canUseEditMenu: false,
        canUseViewMenu: false,
        isExternalMediaAutoLoadEnabled: false,
        isPreviewVisible: false,
        isTocVisible: false,
        onClearRecentFiles: vi.fn(),
        onCopyFilePath: vi.fn(),
        onNew: vi.fn(),
        onOpen: vi.fn(),
        onOpenRecent: vi.fn(),
        onSave,
        onSetThemeMode: vi.fn(),
        onToggleExternalMedia: vi.fn(),
        onTogglePreview: vi.fn(),
        onToggleToc: vi.fn(),
        recentFiles: [],
        themeMode: "system",
      });

      onReady(nextControls);
      return null;
    }

    await act(async () => {
      root.render(createElement(SaveHarness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
      }));
    });

    await act(async () => {
      controls.menuHandlers.onSave();
      controls.menuHandlers.onSaveAs();
    });

    expect(onSave).toHaveBeenNthCalledWith(1, false);
    expect(onSave).toHaveBeenNthCalledWith(2, true);
  });
});
