import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAppViewState } from "./useAppViewState";

type Controls = ReturnType<typeof useAppViewState>;

function Harness({
  onReady,
  overrides,
}: {
  onReady: (controls: Controls) => void;
  overrides?: Partial<Parameters<typeof useAppViewState>[0]>;
}) {
  const controls = useAppViewState({
    filePath: null,
    filename: null,
    isDirty: false,
    isWelcomeVisible: true,
    isWindowVisible: true,
    pendingAction: null,
    ...overrides,
  });

  onReady(controls);
  return null;
}

describe("useAppViewState", () => {
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

  it("derives the default welcome-state UI snapshot", async () => {
    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
      }));
    });

    expect(controls.activeFilename).toBe("ClipMark");
    expect(controls.visibleDocumentStatus).toBeNull();
    expect(controls.windowTitle).toBe("ClipMark");
    expect(controls.canSaveDocument).toBe(false);
    expect(controls.canTogglePanels).toBe(false);
    expect(controls.canCopyFilePath).toBe(false);
    expect(controls.dialogState).toEqual({
      confirmLabel: "Continue Editing",
      description: "ClipMark has unsaved changes. Save first, or keep editing without changing the current document.",
      title: "Save changes before continuing?",
    });
  });

  it("derives document and close-dialog state from the active session", async () => {
    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          filePath: "/tmp/draft.md",
          filename: "draft.md",
          isDirty: true,
          isWelcomeVisible: false,
          pendingAction: { type: "closeWindow" },
        },
      }));
    });

    expect(controls.activeFilename).toBe("draft.md");
    expect(controls.documentStatus).toBe("edited");
    expect(controls.visibleDocumentStatus).toBe("edited");
    expect(controls.windowTitle).toBe("draft.md - edited");
    expect(controls.canSaveDocument).toBe(true);
    expect(controls.canTogglePanels).toBe(true);
    expect(controls.canCopyFilePath).toBe(true);
    expect(controls.dialogState).toEqual({
      confirmLabel: "Close Without Saving",
      description: "draft.md has unsaved changes. Save first or close this window without keeping the latest edits.",
      title: "Save changes before closing?",
    });
  });
});
