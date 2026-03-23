import { describe, expect, it } from "vitest";
import {
  getPostDiscardResolution,
  getPostSaveResolution,
} from "./pending-action";

describe("pending action resolution", () => {
  it("forces close after save when the pending action is close", () => {
    expect(getPostSaveResolution({ type: "close" })).toBe("force-close");
  });

  it("performs non-close actions after save", () => {
    expect(getPostSaveResolution({ type: "new" })).toBe("perform");
    expect(getPostSaveResolution({ type: "open" })).toBe("perform");
    expect(
      getPostSaveResolution({ path: "/tmp/note.md", type: "openRecent" }),
    ).toBe("perform");
  });

  it("cancels close on discard", () => {
    expect(getPostDiscardResolution({ type: "close" })).toBe("cancel");
  });

  it("cancels non-close actions on discard", () => {
    expect(getPostDiscardResolution({ type: "new" })).toBe("cancel");
    expect(getPostDiscardResolution({ type: "open" })).toBe("cancel");
    expect(
      getPostDiscardResolution({ path: "/tmp/note.md", type: "openRecent" }),
    ).toBe("cancel");
  });
});
