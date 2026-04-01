import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWindowShortcuts } from "./useWindowShortcuts";

function Harness({
  onNew,
  onOpen,
  onSave,
}: {
  onNew: () => void;
  onOpen: () => void;
  onSave: (saveAs?: boolean) => void;
}) {
  useWindowShortcuts({ onNew, onOpen, onSave });
  return null;
}

describe("useWindowShortcuts", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

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

  it("routes cmd/ctrl+n, o, s to the provided handlers", async () => {
    const onNew = vi.fn();
    const onOpen = vi.fn();
    const onSave = vi.fn();

    await act(async () => {
      root.render(createElement(Harness, {
        onNew,
        onOpen,
        onSave,
      }));
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", {
        bubbles: true,
        ctrlKey: true,
        key: "n",
      }));
      window.dispatchEvent(new KeyboardEvent("keydown", {
        bubbles: true,
        ctrlKey: true,
        key: "o",
      }));
      window.dispatchEvent(new KeyboardEvent("keydown", {
        bubbles: true,
        ctrlKey: true,
        key: "s",
        shiftKey: true,
      }));
    });

    expect(onNew).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(true);
  });

  it("ignores keys without the modifier", async () => {
    const onNew = vi.fn();
    const onOpen = vi.fn();
    const onSave = vi.fn();

    await act(async () => {
      root.render(createElement(Harness, {
        onNew,
        onOpen,
        onSave,
      }));
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", {
        bubbles: true,
        key: "n",
      }));
    });

    expect(onNew).not.toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
