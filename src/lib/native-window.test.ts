import { describe, expect, it, vi } from "vitest";
import { hideNativeWindow, showNativeWindow } from "./native-window";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./file-system", () => ({
  isTauriRuntime: () => true,
}));

describe("hideNativeWindow", () => {
  it("invokes the native hide command in Tauri", async () => {
    const { invoke } = await import("@tauri-apps/api/core");

    await hideNativeWindow();

    expect(invoke).toHaveBeenCalledWith("hide_window");
  });
});

describe("showNativeWindow", () => {
  it("invokes the native show command in Tauri", async () => {
    const { invoke } = await import("@tauri-apps/api/core");

    await showNativeWindow();

    expect(invoke).toHaveBeenCalledWith("show_window");
  });
});
