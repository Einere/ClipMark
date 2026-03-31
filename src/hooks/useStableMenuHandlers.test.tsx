import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MenuHandlers } from "../lib/menu";
import { useStableMenuHandlers } from "./useStableMenuHandlers";

let capturedHandlers: MenuHandlers | null = null;

function Harness({ handlers }: { handlers: MenuHandlers }) {
  capturedHandlers = useStableMenuHandlers(handlers);
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

describe("useStableMenuHandlers", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    capturedHandlers = null;
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("returns the same handler object across re-renders", async () => {
    const firstHandlers = createHandlers("first");
    const secondHandlers = createHandlers("second");

    await act(async () => {
      root.render(createElement(Harness, { handlers: firstHandlers }));
    });

    const initialStableHandlers = capturedHandlers;

    await act(async () => {
      root.render(createElement(Harness, { handlers: secondHandlers }));
    });

    expect(capturedHandlers).toBe(initialStableHandlers);
  });

  it("calls the latest callbacks through the stable handler object", async () => {
    const firstHandlers = createHandlers("first");
    const secondHandlers = createHandlers("second");

    await act(async () => {
      root.render(createElement(Harness, { handlers: firstHandlers }));
    });

    await act(async () => {
      root.render(createElement(Harness, { handlers: secondHandlers }));
    });

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
  });
});
