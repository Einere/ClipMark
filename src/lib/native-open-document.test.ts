import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  NATIVE_OPEN_DOCUMENT_EVENT,
  setupNativeOpenDocumentListener,
} from "./native-open-document";

const { isTauriRuntime, listen } = vi.hoisted(() => ({
  isTauriRuntime: vi.fn(() => true),
  listen: vi.fn(),
}));

vi.mock("./file-system", () => ({
  isTauriRuntime,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen,
}));

describe("setupNativeOpenDocumentListener", () => {
  beforeEach(() => {
    isTauriRuntime.mockReturnValue(true);
    isTauriRuntime.mockClear();
    listen.mockReset();
  });

  it("registers a listener for the native open document event", async () => {
    const onOpenDocument = vi.fn();
    const dispose = vi.fn();

    listen.mockImplementation(async (_eventName, handler) => {
      handler({ payload: { path: "/tmp/clipmark.md" } });
      return dispose;
    });

    const result = await setupNativeOpenDocumentListener(onOpenDocument);

    expect(listen).toHaveBeenCalledWith(
      NATIVE_OPEN_DOCUMENT_EVENT,
      expect.any(Function),
    );
    expect(onOpenDocument).toHaveBeenCalledWith("/tmp/clipmark.md");
    expect(result).toBe(dispose);
  });

  it("ignores invalid payloads", async () => {
    const onOpenDocument = vi.fn();

    listen.mockImplementation(async (_eventName, handler) => {
      handler({ payload: {} });
      handler({ payload: { path: "" } });
      handler({ payload: { path: 42 } });
      return vi.fn();
    });

    await setupNativeOpenDocumentListener(onOpenDocument);

    expect(onOpenDocument).not.toHaveBeenCalled();
  });

  it("does nothing outside Tauri", async () => {
    isTauriRuntime.mockReturnValue(false);
    const onOpenDocument = vi.fn();

    const result = await setupNativeOpenDocumentListener(onOpenDocument);

    expect(listen).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});
