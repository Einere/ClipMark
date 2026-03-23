import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { showNativeCloseSheet } from "./native-close-sheet";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

describe("showNativeCloseSheet", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  afterEach(() => {
    delete (window as Window & { __TAURI_INTERNALS__?: object })
      .__TAURI_INTERNALS__;
  });

  it("returns unsupported outside the tauri runtime", async () => {
    await expect(showNativeCloseSheet("note.md")).resolves.toBe("unsupported");
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("returns the native sheet response when the backend supports it", async () => {
    (window as Window & { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__ = {};
    invokeMock.mockResolvedValue("discard");

    await expect(showNativeCloseSheet("note.md")).resolves.toBe("discard");
    expect(invokeMock).toHaveBeenCalledWith("show_unsaved_changes_sheet", {
      filename: "note.md",
    });
  });

  it("falls back to unsupported when the backend returns an unknown value", async () => {
    (window as Window & { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__ = {};
    invokeMock.mockResolvedValue("later");

    await expect(showNativeCloseSheet("note.md")).resolves.toBe("unsupported");
  });

  it("falls back to unsupported when the backend command fails", async () => {
    (window as Window & { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__ = {};
    invokeMock.mockRejectedValue(new Error("unavailable"));

    await expect(showNativeCloseSheet("note.md")).resolves.toBe("unsupported");
  });
});
