import { describe, expect, it } from "vitest";
import {
  buildWindowTitle,
  getDocumentStatus,
  getVisibleDocumentStatus,
} from "./window-state";

describe("buildWindowTitle", () => {
  it("keeps the filename only for initial documents", () => {
    expect(buildWindowTitle("Untitled.md", "initial")).toBe("Untitled.md");
  });

  it("builds an edited title for edited documents", () => {
    expect(buildWindowTitle("note.md", "edited")).toBe("note.md - edited");
  });

  it("builds a saved title for saved documents", () => {
    expect(buildWindowTitle("note.md", "saved")).toBe("note.md - saved");
  });
});

describe("getDocumentStatus", () => {
  it("returns initial for the welcome screen", () => {
    expect(getDocumentStatus(null, false, true)).toBe("initial");
  });

  it("returns initial for a clean untitled document", () => {
    expect(getDocumentStatus(null, false, false)).toBe("initial");
  });

  it("returns edited for a changed untitled document", () => {
    expect(getDocumentStatus(null, true, false)).toBe("edited");
  });

  it("returns saved for a clean saved document", () => {
    expect(getDocumentStatus("/tmp/note.md", false, false)).toBe("saved");
  });

  it("returns edited for a changed saved document", () => {
    expect(getDocumentStatus("/tmp/note.md", true, false)).toBe("edited");
  });
});

describe("getVisibleDocumentStatus", () => {
  it("hides the initial status label", () => {
    expect(getVisibleDocumentStatus("initial")).toBeNull();
  });

  it("shows saved and edited labels", () => {
    expect(getVisibleDocumentStatus("saved")).toBe("saved");
    expect(getVisibleDocumentStatus("edited")).toBe("edited");
  });
});
