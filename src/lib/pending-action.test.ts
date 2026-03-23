import { describe, expect, it } from "vitest";
import {
  getPostDiscardResolution,
  getPostSaveResolution,
} from "./pending-action";

describe("pending action resolution", () => {
  it("hides the window after save when the pending action is closeWindow", () => {
    expect(getPostSaveResolution({ type: "closeWindow" })).toBe("hide-window");
  });

  it("performs non-close actions after save", () => {
    expect(getPostSaveResolution({ type: "new" })).toBe("perform");
    expect(getPostSaveResolution({ type: "open" })).toBe("perform");
    expect(
      getPostSaveResolution({ path: "/tmp/note.md", type: "openRecent" }),
    ).toBe("perform");
  });

  it("hides the window on discard when the pending action is closeWindow", () => {
    expect(getPostDiscardResolution({ type: "closeWindow" })).toBe("hide-window");
  });

  it("cancels non-close actions on discard", () => {
    expect(getPostDiscardResolution({ type: "new" })).toBe("cancel");
    expect(getPostDiscardResolution({ type: "open" })).toBe("cancel");
    expect(
      getPostDiscardResolution({ path: "/tmp/note.md", type: "openRecent" }),
    ).toBe("cancel");
  });
});
