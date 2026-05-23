import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  closeCurrentDocumentWindow,
  createDocumentWindow,
  isDocumentPathOpenElsewhere,
  openDocumentWindow,
  registerWindowDocumentPath,
} from "./document-window";

const invoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (command: string, args?: unknown) =>
    args === undefined ? invoke(command) : invoke(command, args),
}));

vi.mock("./file-system", () => ({
  isTauriRuntime: () => true,
}));

describe("document-window", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("creates a new document window", async () => {
    await createDocumentWindow();
    expect(invoke).toHaveBeenCalledWith("create_document_window");
  });

  it("opens a document path through the native window registry", async () => {
    await openDocumentWindow("/tmp/a.md");
    expect(invoke).toHaveBeenCalledWith("open_document_window", {
      path: "/tmp/a.md",
    });
  });

  it("registers the current window document path", async () => {
    await registerWindowDocumentPath("/tmp/a.md");
    expect(invoke).toHaveBeenCalledWith("register_window_document_path", {
      path: "/tmp/a.md",
    });
  });

  it("checks whether a Save As target is open in another window", async () => {
    invoke.mockResolvedValue(true);
    await expect(isDocumentPathOpenElsewhere("/tmp/a.md")).resolves.toBe(true);
    expect(invoke).toHaveBeenCalledWith("is_document_path_open_elsewhere", {
      path: "/tmp/a.md",
    });
  });

  it("closes the current document window", async () => {
    await closeCurrentDocumentWindow();
    expect(invoke).toHaveBeenCalledWith("close_document_window");
  });
});
