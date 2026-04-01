import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppMenuController } from "./useAppMenuController";
import type { MenuHandlers, MenuState } from "../lib/menu";

const dispose = vi.fn().mockResolvedValue(undefined);
const sync = vi.fn().mockResolvedValue(undefined);
const setupAppMenu = vi.fn();

let capturedHandlers: MenuHandlers | null = null;

vi.mock("../lib/menu", () => ({
  setupAppMenu: (handlers: MenuHandlers) => {
    capturedHandlers = handlers;
    return setupAppMenu(handlers);
  },
}));

function Harness({
  handlers,
  state,
}: {
  handlers: MenuHandlers;
  state: MenuState;
}) {
  useAppMenuController(handlers, state);
  return null;
}

function createHandlers(label: string) {
  return {
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
    onToggleToc: vi.fn(() => label),
  } satisfies MenuHandlers;
}

function createState(): MenuState {
  return {
    canUseEditMenu: true,
    canUseViewMenu: true,
    canCopyFilePath: true,
    canSave: true,
    canTogglePanels: true,
    isExternalMediaAutoLoadEnabled: true,
    isPreviewVisible: true,
    isTocVisible: true,
    themeMode: "system",
    recentFiles: [],
  };
}

function createDeferredController() {
  let resolve: ((value: { dispose: typeof dispose; sync: typeof sync }) => void) | undefined;
  const promise = new Promise<{ dispose: typeof dispose; sync: typeof sync }>((nextResolve) => {
    resolve = nextResolve;
  });

  return {
    promise,
    resolve: () => resolve?.({ dispose, sync }),
  };
}

describe("useAppMenuController", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    capturedHandlers = null;
    dispose.mockClear();
    setupAppMenu.mockReset();
    sync.mockClear();
    setupAppMenu.mockResolvedValue({ dispose, sync });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("creates the app menu once even when handlers and state change", async () => {
    const firstHandlers = createHandlers("first");
    const secondHandlers = createHandlers("second");

    await act(async () => {
      root.render(createElement(Harness, {
        handlers: firstHandlers,
        state: createState(),
      }));
    });

    await act(async () => {
      root.render(createElement(Harness, {
        handlers: secondHandlers,
        state: {
          ...createState(),
          isPreviewVisible: false,
        },
      }));
    });

    expect(setupAppMenu).toHaveBeenCalledTimes(1);
    expect(sync).toHaveBeenCalledTimes(2);
  });

  it("syncs the latest state immediately after async menu setup resolves", async () => {
    const deferredController = createDeferredController();
    setupAppMenu.mockReturnValueOnce(deferredController.promise);
    const handlers = createHandlers("first");

    await act(async () => {
      root.render(createElement(Harness, {
        handlers,
        state: createState(),
      }));
    });

    await act(async () => {
      root.render(createElement(Harness, {
        handlers,
        state: {
          ...createState(),
          isPreviewVisible: false,
          isTocVisible: false,
        },
      }));
    });

    expect(sync).not.toHaveBeenCalled();

    await act(async () => {
      deferredController.resolve();
      await deferredController.promise;
    });

    expect(sync).toHaveBeenCalledTimes(1);
    expect(sync).toHaveBeenCalledWith(expect.objectContaining({
      isPreviewVisible: false,
      isTocVisible: false,
    }));
  });

  it("uses the latest handler callbacks without recreating the menu", async () => {
    const firstHandlers = createHandlers("first");
    const secondHandlers = createHandlers("second");

    await act(async () => {
      root.render(createElement(Harness, {
        handlers: firstHandlers,
        state: createState(),
      }));
    });

    await act(async () => {
      root.render(createElement(Harness, {
        handlers: secondHandlers,
        state: createState(),
      }));
    });

    expect(capturedHandlers).not.toBeNull();

    await act(async () => {
      capturedHandlers?.onToggleToc();
      capturedHandlers?.onSetThemeMode("dark");
      capturedHandlers?.onOpenRecent("/tmp/recent.md");
    });

    expect(firstHandlers.onToggleToc).not.toHaveBeenCalled();
    expect(secondHandlers.onToggleToc).toHaveBeenCalledTimes(1);
    expect(firstHandlers.onSetThemeMode).not.toHaveBeenCalled();
    expect(secondHandlers.onSetThemeMode).toHaveBeenCalledWith("dark");
    expect(firstHandlers.onOpenRecent).not.toHaveBeenCalled();
    expect(secondHandlers.onOpenRecent).toHaveBeenCalledWith("/tmp/recent.md");
    expect(setupAppMenu).toHaveBeenCalledTimes(1);
  });
});
