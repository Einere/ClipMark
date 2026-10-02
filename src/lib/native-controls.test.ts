import { describe, expect, it, vi } from "vitest";
import { syncNativeControls, listenNativeControlAction } from "./native-controls";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));
vi.mock("@tauri-apps/api/window", async () => {
  const { listen } = await import("@tauri-apps/api/event");
  return { getCurrentWindow: () => ({ listen }) };
});
vi.mock("./file-system", () => ({ isTauriRuntime: () => true }));

describe("native document controls", () => {
  it("targets the calling window without accepting another document label", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    await syncNativeControls({ path: "/tmp/note.md", previewOpen: false });
    expect(invoke).toHaveBeenCalledWith("sync_native_controls", { path: "/tmp/note.md", previewOpen: false });
  });

  it("rejects invalid native actions and returns listener cleanup", async () => {
    const { listen } = await import("@tauri-apps/api/event");
    const action = vi.fn();
    const cleanup = await listenNativeControlAction(action);
    const handler = vi.mocked(listen).mock.calls.at(-1)![1];
    handler({ payload: "copy-path" } as never);
    handler({ payload: "wrong-document-action" } as never);
    expect(action.mock.calls).toEqual([["copy-path"]]);
    expect(typeof cleanup).toBe("function");
  });
});
