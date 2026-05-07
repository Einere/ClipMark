import { describe, expect, it } from "vitest";
import { getUnsavedDialogState } from "./unsaved-dialog-state";

describe("getUnsavedDialogState", () => {
  it("returns the close-window copy when the pending action is closeWindow", () => {
    expect(getUnsavedDialogState("draft.md", { type: "closeWindow" })).toEqual({
      confirmLabel: "Close Without Saving",
      description: "draft.md has unsaved changes. Save first or close this window without keeping the latest edits.",
      title: "Save changes before closing?",
    });
  });

  it("returns the continue-editing copy for all non-close actions", () => {
    expect(getUnsavedDialogState("draft.md", { type: "open" })).toEqual({
      confirmLabel: "Continue Editing",
      description: "draft.md has unsaved changes. Save first, or keep editing without changing the current document.",
      title: "Save changes before continuing?",
    });
  });
});
