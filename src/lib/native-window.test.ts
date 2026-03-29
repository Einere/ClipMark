import { describe, expect, it, vi } from "vitest";
import { closeCurrentWindow, hideNativeWindow, openNewWindow, showNativeWindow } from "./native-window";

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

describe("openNewWindow", () => {
  it("새 창을 열 때 file_path 없이 invoke한다", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockClear();

    await openNewWindow();

    expect(invoke).toHaveBeenCalledWith("open_new_window", { filePath: undefined });
  });

  it("파일 경로가 있으면 file_path와 함께 invoke한다", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockClear();

    await openNewWindow("/Users/test/doc.md");

    expect(invoke).toHaveBeenCalledWith("open_new_window", { filePath: "/Users/test/doc.md" });
  });
});

describe("closeCurrentWindow", () => {
  it("close_window를 invoke한다", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockClear();

    await closeCurrentWindow();

    expect(invoke).toHaveBeenCalledWith("close_window");
  });
});
