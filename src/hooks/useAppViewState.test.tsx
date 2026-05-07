import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deriveAppViewState,
  useAppViewState,
} from "./useAppViewState";

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
    const derivedViewState = deriveAppViewState({
      filePath: null,
      filename: null,
      isDirty: false,
      isWelcomeVisible: true,
    });

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
      }));
    });

    expect(derivedViewState).toEqual({
      activeFilename: "ClipMark",
      documentStatus: "initial",
      visibleDocumentStatus: null,
      windowTitle: "ClipMark",
    });
    expect(controls.activeFilename).toBe(derivedViewState.activeFilename);
    expect(controls.documentStatus).toBe(derivedViewState.documentStatus);
    expect(controls.visibleDocumentStatus).toBe(derivedViewState.visibleDocumentStatus);
    expect(controls.windowTitle).toBe(derivedViewState.windowTitle);
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
    const derivedViewState = deriveAppViewState({
      filePath: "/tmp/draft.md",
      filename: "draft.md",
      isDirty: true,
      isWelcomeVisible: false,
    });

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

    expect(derivedViewState).toEqual({
      activeFilename: "draft.md",
      documentStatus: "edited",
      visibleDocumentStatus: "edited",
      windowTitle: "draft.md - edited",
    });
    expect(controls.activeFilename).toBe(derivedViewState.activeFilename);
    expect(controls.documentStatus).toBe(derivedViewState.documentStatus);
    expect(controls.visibleDocumentStatus).toBe(derivedViewState.visibleDocumentStatus);
    expect(controls.windowTitle).toBe(derivedViewState.windowTitle);
    expect(controls.canSaveDocument).toBe(true);
    expect(controls.canTogglePanels).toBe(true);
    expect(controls.canCopyFilePath).toBe(true);
    expect(controls.dialogState).toEqual({
      confirmLabel: "Close Without Saving",
      description: "draft.md has unsaved changes. Save first or close this window without keeping the latest edits.",
      title: "Save changes before closing?",
    });
  });

  it("keeps filename, status, and title derivation stable when the window is hidden", async () => {
    const derivedViewState = deriveAppViewState({
      filePath: "/tmp/draft.md",
      filename: "draft.md",
      isDirty: false,
      isWelcomeVisible: false,
    });

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          filePath: "/tmp/draft.md",
          filename: "draft.md",
          isDirty: false,
          isWelcomeVisible: false,
          isWindowVisible: false,
          pendingAction: { type: "closeWindow" },
        },
      }));
    });

    expect(derivedViewState).toEqual({
      activeFilename: "draft.md",
      documentStatus: "saved",
      visibleDocumentStatus: "saved",
      windowTitle: "draft.md - saved",
    });
    expect(controls.activeFilename).toBe(derivedViewState.activeFilename);
    expect(controls.documentStatus).toBe(derivedViewState.documentStatus);
    expect(controls.visibleDocumentStatus).toBe(derivedViewState.visibleDocumentStatus);
    expect(controls.windowTitle).toBe(derivedViewState.windowTitle);
    expect(controls.canSaveDocument).toBe(false);
    expect(controls.canTogglePanels).toBe(false);
    expect(controls.canCopyFilePath).toBe(false);
  });
});
