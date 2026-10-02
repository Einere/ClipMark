import { expect, it } from "vitest";
import { acceptPreviewSnapshot, shouldResumePreview } from "./preview-window-state";

it("only accepts newer state from the same window connection", () => {
  const current = { ownerLabel: "document-1", connectionId: "1", sequence: 4 };
  expect(acceptPreviewSnapshot(current, { ...current, sequence: 5 })).toBe(true);
  expect(acceptPreviewSnapshot(current, { ...current, sequence: 3 })).toBe(false);
  expect(acceptPreviewSnapshot(current, { ...current, ownerLabel: "document-2", sequence: 9 })).toBe(false);
  expect(acceptPreviewSnapshot(current, { ...current, connectionId: "2", sequence: 9 })).toBe(false);
});

it("resumes only when another editor action occurs", () => {
  expect(shouldResumePreview(7, 7)).toBe(false);
  expect(shouldResumePreview(7, 8)).toBe(true);
});
