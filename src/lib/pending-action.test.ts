import { describe, expect, it } from "vitest";
import {
  getPostDiscardResolution,
  getPostSaveResolution,
} from "./pending-action";

describe("pending action resolution", () => {
  it("hides the window after save when the pending action is closeWindow", () => {
    expect(getPostSaveResolution({ type: "closeWindow" })).toBe("hide-window");
  });

  it("hides the window on discard when the pending action is closeWindow", () => {
    expect(getPostDiscardResolution({ type: "closeWindow" })).toBe("hide-window");
  });
});
