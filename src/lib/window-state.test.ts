import { describe, expect, it } from "vitest";
import { buildWindowTitle, shouldDeferNativeWindowSync } from "./window-state";

describe("buildWindowTitle", () => {
  it("returns the app name on the welcome screen", () => {
    expect(buildWindowTitle("note.md", true, true)).toBe("ClipMark");
  });

  it("builds an edited title for open documents", () => {
    expect(buildWindowTitle("note.md", true, false)).toBe("note.md - edited");
  });

  it("builds a saved title for clean documents", () => {
    expect(buildWindowTitle("note.md", false, false)).toBe("note.md - saved");
  });
});

describe("shouldDeferNativeWindowSync", () => {
  it("defers native sync while editing with editor focus", () => {
    expect(shouldDeferNativeWindowSync(true, true)).toBe(true);
  });

  it("does not defer when the editor is not focused", () => {
    expect(shouldDeferNativeWindowSync(false, true)).toBe(false);
  });

  it("does not defer when the document is saved", () => {
    expect(shouldDeferNativeWindowSync(true, false)).toBe(false);
  });
});
