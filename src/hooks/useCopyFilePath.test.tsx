import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCopyFilePath } from "./useCopyFilePath";

type Controls = ReturnType<typeof useCopyFilePath>;

function Harness({
  onReady,
  overrides,
}: {
  onReady: (controls: Controls) => void;
  overrides?: Partial<Parameters<typeof useCopyFilePath>[0]>;
}) {
  const controls = useCopyFilePath({
    filePath: "/tmp/draft.md",
    successToastVariant: "success",
    showToast: vi.fn(),
    ...overrides,
  });

  onReady(controls);
  return null;
}

describe("useCopyFilePath", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let controls: Controls;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it("copies the file path and shows a success toast", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn();
    vi.stubGlobal("navigator", {
      clipboard: { writeText },
    });

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          showToast,
        },
      }));
    });

    await act(async () => {
      await controls.copyFilePath();
    });

    expect(writeText).toHaveBeenCalledWith("/tmp/draft.md");
    expect(showToast).toHaveBeenCalledWith(
      "Copied the file path to the clipboard.",
      "success",
    );
  });

  it("shows an error toast when the clipboard write fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("clipboard failed"));
    const showToast = vi.fn();
    vi.stubGlobal("navigator", {
      clipboard: { writeText },
    });

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          showToast,
        },
      }));
    });

    await act(async () => {
      await controls.copyFilePath();
    });

    expect(writeText).toHaveBeenCalledWith("/tmp/draft.md");
    expect(showToast).toHaveBeenCalledWith(
      "Could not copy the file path.",
      "error",
    );
  });

  it("returns early when there is no file path", async () => {
    const writeText = vi.fn();
    const showToast = vi.fn();
    vi.stubGlobal("navigator", {
      clipboard: { writeText },
    });

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          filePath: null,
          showToast,
        },
      }));
    });

    await act(async () => {
      await controls.copyFilePath();
    });

    expect(writeText).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });
});
