import { describe, expect, it } from "vitest";
import {
  findClosestPreviewAnchor,
  getPreviewAnchorKey,
} from "./preview-scroll";

describe("getPreviewAnchorKey", () => {
  it("returns a stable key for an anchor range", () => {
    expect(getPreviewAnchorKey({ lineStart: 12, lineEnd: 16 })).toBe("12:16");
  });
});

describe("findClosestPreviewAnchor", () => {
  const anchors = [
    { lineEnd: 2, lineStart: 1 },
    { lineEnd: 6, lineStart: 4 },
    { lineEnd: 10, lineStart: 8 },
  ];

  it("returns the anchor containing the active line", () => {
    expect(findClosestPreviewAnchor(anchors, 5)).toEqual({
      lineEnd: 6,
      lineStart: 4,
    });
  });

  it("falls back to the closest previous anchor when the active line is between blocks", () => {
    expect(findClosestPreviewAnchor(anchors, 7)).toEqual({
      lineEnd: 6,
      lineStart: 4,
    });
  });

  it("returns the first anchor for lines before the first mapped block", () => {
    expect(findClosestPreviewAnchor(anchors, 1)).toEqual({
      lineEnd: 2,
      lineStart: 1,
    });
  });

  it("returns null for invalid input", () => {
    expect(findClosestPreviewAnchor([], 3)).toBeNull();
    expect(findClosestPreviewAnchor(anchors, null)).toBeNull();
    expect(findClosestPreviewAnchor(anchors, 0)).toBeNull();
  });
});
