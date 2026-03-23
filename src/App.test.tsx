import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const clearDebugLog = vi.fn().mockResolvedValue(undefined);
const ensureWindowVisible = vi.fn().mockResolvedValue(undefined);
const hideWindow = vi.fn().mockResolvedValue(undefined);
const loadRecentFiles = vi.fn(() => []);
const openMarkdownDocument = vi.fn();
const openMarkdownDocumentWithoutShowingWindow = vi.fn();
const removeRecentFile = vi.fn((files) => files);
const showNativeCloseSheet = vi.fn();
const setupAppMenu = vi.fn().mockResolvedValue(undefined);

let closeRequestHandler: (() => Promise<void> | void) | null = null;
let menuHandlers: Record<string, unknown> | null = null;

vi.mock("./hooks/useNativeWindowState", () => ({
  useNativeWindowState: (options: { onRequestClose: () => Promise<void> | void }) => {
    closeRequestHandler = options.onRequestClose;
    return {
      ensureWindowVisible,
      handleEditorFocusChange: vi.fn(),
      hideWindow,
    };
  },
}));

vi.mock("./lib/debug-log", () => ({
  clearDebugLog,
  logDebug: vi.fn(),
}));

vi.mock("./lib/file-system", () => ({
  isTauriRuntime: () => true,
  openMarkdownDocument,
  openMarkdownDocumentWithoutShowingWindow,
  saveMarkdownDocument: vi.fn(),
}));

vi.mock("./lib/menu", () => ({
  setupAppMenu: (handlers: Record<string, unknown>) => {
    menuHandlers = handlers;
    return setupAppMenu(handlers);
  },
}));

vi.mock("./lib/native-close-sheet", () => ({
  showNativeCloseSheet,
}));

vi.mock("./lib/recent-files", () => ({
  addRecentFile: (files: Array<{ filename: string; path: string }>, path: string) => [
    { filename: path.split("/").pop() ?? path, path },
    ...files,
  ],
  clearRecentFiles: vi.fn(() => []),
  loadRecentFiles,
  openRecentFile: vi.fn(),
  removeRecentFile,
}));

describe("App close window session", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    closeRequestHandler = null;
    menuHandlers = null;
    clearDebugLog.mockClear();
    ensureWindowVisible.mockClear();
    hideWindow.mockClear();
    loadRecentFiles.mockClear();
    openMarkdownDocument.mockReset();
    openMarkdownDocumentWithoutShowingWindow.mockReset();
    removeRecentFile.mockClear();
    setupAppMenu.mockClear();
    showNativeCloseSheet.mockClear();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("clears the current document before hiding the window", async () => {
    openMarkdownDocument.mockResolvedValue({
      filename: "note.md",
      markdown: "# Title",
      path: "/tmp/note.md",
    });

    await act(async () => {
      root.render(createElement(App));
    });

    const openButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Open Markdown File",
    );

    await act(async () => {
      openButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("/tmp/note.md");
    expect(closeRequestHandler).not.toBeNull();

    await act(async () => {
      await closeRequestHandler?.();
    });

    expect(hideWindow).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Open a recent archive or start a new Markdown file.");
    expect(container.textContent).not.toContain("/tmp/note.md");
  });

  it("keeps the landing screen open when New is selected while the window is hidden", async () => {
    await act(async () => {
      root.render(createElement(App));
    });

    expect(menuHandlers).not.toBeNull();
    expect(closeRequestHandler).not.toBeNull();

    await act(async () => {
      await closeRequestHandler?.();
    });

    await act(async () => {
      await (menuHandlers?.onNew as (() => void) | undefined)?.();
    });

    expect(ensureWindowVisible).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Open a recent archive or start a new Markdown file.");
  });

  it("opens the file picker when Open is selected while the window is hidden", async () => {
    openMarkdownDocumentWithoutShowingWindow.mockResolvedValue({
      filename: "opened.md",
      markdown: "# Opened",
      path: "/tmp/opened.md",
    });

    await act(async () => {
      root.render(createElement(App));
    });

    expect(menuHandlers).not.toBeNull();
    expect(closeRequestHandler).not.toBeNull();

    await act(async () => {
      await closeRequestHandler?.();
    });

    await act(async () => {
      await (menuHandlers?.onOpen as (() => void) | undefined)?.();
    });

    expect(ensureWindowVisible).toHaveBeenCalledTimes(1);
    expect(openMarkdownDocumentWithoutShowingWindow).toHaveBeenCalledTimes(1);
    expect(openMarkdownDocument).not.toHaveBeenCalled();
    expect(container.textContent).toContain("/tmp/opened.md");
  });
});
