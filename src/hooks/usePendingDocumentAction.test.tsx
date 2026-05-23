import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePendingDocumentAction } from "./usePendingDocumentAction";

type Controls = ReturnType<typeof usePendingDocumentAction>;

function Harness({
  onReady,
  overrides,
}: {
  onReady: (controls: Controls) => void;
  overrides?: Partial<Parameters<typeof usePendingDocumentAction>[0]>;
}) {
  const controls = usePendingDocumentAction({
    activeFilename: "draft.md",
    hideWindowAndResetDocument: vi.fn().mockResolvedValue(undefined),
    saveDocument: vi.fn().mockResolvedValue(true),
    ...overrides,
  });

  onReady(controls);
  return null;
}

describe("usePendingDocumentAction", () => {
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

  it("starts without a queued close action", async () => {
    const hideWindowAndResetDocument = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          hideWindowAndResetDocument,
        },
      }));
    });

    expect(hideWindowAndResetDocument).not.toHaveBeenCalled();
    expect(controls.pendingAction).toBe(null);
  });

  it("does not expose hidden-window visible action requests", async () => {
    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
      }));
    });

    expect(controls.pendingAction).toBe(null);
    expect("requestVisibleAction" in controls).toBe(false);
  });

  it("resolves queued close actions by saving and then hiding the window", async () => {
    const saveDocument = vi.fn().mockResolvedValue(true);
    const hideWindowAndResetDocument = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          hideWindowAndResetDocument,
          saveDocument,
        },
      }));
    });

    await act(async () => {
      controls.queuePendingAction({ type: "closeWindow" });
    });

    await act(async () => {
      await controls.resolvePendingActionWithSave();
    });

    expect(saveDocument).toHaveBeenCalledWith({ activeFilename: "draft.md" });
    expect(hideWindowAndResetDocument).toHaveBeenCalledTimes(1);
    expect(controls.pendingAction).toBeNull();
  });

});
