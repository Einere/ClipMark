import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNativeOpenDocumentListener } from "./useNativeOpenDocumentListener";

const setupNativeOpenDocumentListener = vi.fn();

vi.mock("../lib/native-open-document", () => ({
  setupNativeOpenDocumentListener: (listener: (path: string) => void) =>
    setupNativeOpenDocumentListener(listener),
}));

function Harness({
  onOpenDocument,
}: {
  onOpenDocument: (path: string) => void;
}) {
  useNativeOpenDocumentListener({ onOpenDocument });
  return null;
}

describe("useNativeOpenDocumentListener", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    setupNativeOpenDocumentListener.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("forwards native open-document events to the provided handler", async () => {
    const onOpenDocument = vi.fn();
    let registeredListener: ((path: string) => void) | undefined;

    setupNativeOpenDocumentListener.mockImplementation(async (listener) => {
      registeredListener = listener;
      return () => undefined;
    });

    await act(async () => {
      root.render(createElement(Harness, {
        onOpenDocument,
      }));
    });

    act(() => {
      registeredListener?.("/tmp/recent.md");
    });

    expect(onOpenDocument).toHaveBeenCalledWith("/tmp/recent.md");
  });

  it("disposes late listeners when the component unmounts before registration completes", async () => {
    const dispose = vi.fn();
    let resolveSetup: ((dispose: () => void) => void) | undefined;

    setupNativeOpenDocumentListener.mockImplementation(() => (
      new Promise<(dispose: () => void) => void>((resolve) => {
        resolveSetup = resolve;
      })
    ));

    await act(async () => {
      root.render(createElement(Harness, {
        onOpenDocument: vi.fn(),
      }));
    });

    await act(async () => {
      root.unmount();
    });

    await act(async () => {
      resolveSetup?.(dispose);
      await Promise.resolve();
    });

    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
