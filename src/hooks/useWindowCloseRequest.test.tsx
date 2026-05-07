import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWindowCloseRequest } from "./useWindowCloseRequest";

const showNativeCloseSheet = vi.fn();

vi.mock("../lib/native-close-sheet", () => ({
  showNativeCloseSheet: (filename: string) => showNativeCloseSheet(filename),
}));

function Harness({
  onReady,
  overrides,
}: {
  onReady: (handleCloseRequest: ReturnType<typeof useWindowCloseRequest>) => void;
  overrides?: Partial<Parameters<typeof useWindowCloseRequest>[0]>;
}) {
  const handleCloseRequest = useWindowCloseRequest({
    activeFilename: "draft.md",
    closeWindowSession: vi.fn().mockResolvedValue(undefined),
    isDirty: false,
    queuePendingAction: vi.fn(),
    saveDocument: vi.fn().mockResolvedValue(true),
    ...overrides,
  });

  onReady(handleCloseRequest);
  return null;
}

describe("useWindowCloseRequest", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let handleCloseRequest: ReturnType<typeof useWindowCloseRequest>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    showNativeCloseSheet.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("closes immediately when the document is not dirty", async () => {
    const closeWindowSession = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextHandleCloseRequest) => {
          handleCloseRequest = nextHandleCloseRequest;
        },
        overrides: {
          closeWindowSession,
          isDirty: false,
        },
      }));
    });

    await act(async () => {
      await handleCloseRequest();
    });

    expect(closeWindowSession).toHaveBeenCalledTimes(1);
    expect(showNativeCloseSheet).not.toHaveBeenCalled();
  });

  it("queues a pending close when the native sheet is unsupported", async () => {
    const queuePendingAction = vi.fn();
    showNativeCloseSheet.mockResolvedValue("unsupported");

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextHandleCloseRequest) => {
          handleCloseRequest = nextHandleCloseRequest;
        },
        overrides: {
          isDirty: true,
          queuePendingAction,
        },
      }));
    });

    await act(async () => {
      await handleCloseRequest();
    });

    expect(queuePendingAction).toHaveBeenCalledWith({ type: "closeWindow" });
  });

  it("saves first and then closes when the native sheet returns save", async () => {
    const closeWindowSession = vi.fn().mockResolvedValue(undefined);
    const saveDocument = vi.fn().mockResolvedValue(true);
    showNativeCloseSheet.mockResolvedValue("save");

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextHandleCloseRequest) => {
          handleCloseRequest = nextHandleCloseRequest;
        },
        overrides: {
          closeWindowSession,
          isDirty: true,
          saveDocument,
        },
      }));
    });

    await act(async () => {
      await handleCloseRequest();
    });

    expect(saveDocument).toHaveBeenCalledWith({ activeFilename: "draft.md" });
    expect(closeWindowSession).toHaveBeenCalledTimes(1);
  });
});
