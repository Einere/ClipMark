import { describe, expect, it, vi } from "vitest";
import { openExternalUri, resolvePreviewUri } from "./external-link";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./file-system", () => ({
  isTauriRuntime: () => true,
}));

describe("resolvePreviewUri", () => {
  it("marks in-document fragment links as non-openable", () => {
    expect(resolvePreviewUri("#section-1", "/tmp/note.md")).toEqual({
      kind: "fragment",
    });
  });

  it("blocks disallowed protocols", () => {
    expect(resolvePreviewUri("javascript:alert('x')", "/tmp/note.md")).toEqual({
      kind: "blocked",
    });
  });

  it("resolves relative paths against the current document path", () => {
    expect(resolvePreviewUri("./reference.md", "/tmp/docs/note.md")).toEqual({
      kind: "external",
      uri: "file:///tmp/docs/reference.md",
    });
  });

  it("passes through allowed absolute URLs", () => {
    expect(resolvePreviewUri("https://example.com/docs", null)).toEqual({
      kind: "external",
      uri: "https://example.com/docs",
    });
  });

  it("accepts tel links for external handoff", () => {
    expect(resolvePreviewUri("tel:+82-2-555-1234", null)).toEqual({
      kind: "external",
      uri: "tel:+82-2-555-1234",
    });
  });
});

describe("openExternalUri", () => {
  it("invokes the native external open command in Tauri", async () => {
    const { invoke } = await import("@tauri-apps/api/core");

    await openExternalUri("https://example.com");

    expect(invoke).toHaveBeenCalledWith("open_external_url", {
      url: "https://example.com",
    });
  });
});
