import { describe, expect, it } from "vitest";
import { buildWindowTitle } from "./window-state";

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
