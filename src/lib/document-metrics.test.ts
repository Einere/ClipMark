import { describe, expect, it } from "vitest";
import { summarizeDocument } from "./document-metrics";

describe("summarizeDocument", () => {
  it("returns zeroed metrics for blank markdown", () => {
    expect(summarizeDocument("   \n\n")).toEqual({
      characterCount: 0,
      estimatedReadingMinutes: 0,
      wordCount: 0,
    });
  });

  it("counts words and compacted characters from markdown text", () => {
    expect(summarizeDocument("# Heading\n\nHello   world from ClipMark.")).toEqual({
      characterCount: 36,
      estimatedReadingMinutes: 1,
      wordCount: 5,
    });
  });

  it("supports mixed language content", () => {
    expect(summarizeDocument("문서 요약 test 123")).toEqual({
      characterCount: 14,
      estimatedReadingMinutes: 1,
      wordCount: 4,
    });
  });
});
