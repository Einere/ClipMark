import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentWorkspaceFooter } from "./DocumentWorkspaceFooter";

const showToast = vi.fn();

vi.mock("../toast/ToastProvider", () => ({
  useToast: () => ({
    showToast,
  }),
}));

function createMetrics(overrides?: Partial<{
  characterCount: number;
  estimatedReadingMinutes: number;
  lineCount: number;
  wordCount: number;
}>) {
  return {
    characterCount: 180,
    estimatedReadingMinutes: 1,
    lineCount: 12,
    wordCount: 42,
    ...overrides,
  };
}

function createTestRenderer() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  return {
    cleanup() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
    container,
    render(element: ReactNode) {
      act(() => {
        root.render(element);
      });
    },
  };
}

describe("DocumentWorkspaceFooter", () => {
  let renderer: ReturnType<typeof createTestRenderer>;

  beforeEach(() => {
    renderer = createTestRenderer();
    showToast.mockReset();
  });

  afterEach(() => {
    renderer.cleanup();
  });

  it("renders saved document metadata and copies the current path on click", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: { writeText },
    });

    renderer.render(
      <DocumentWorkspaceFooter
        documentStatus="saved"
        filePath="/Users/einere/notes/research.md"
        headingCount={2}
        metrics={createMetrics()}
      />,
    );

    const button = renderer.container.querySelector(".editor-workspace__path-button") as
      | HTMLButtonElement
      | null;

    expect(button?.textContent).toContain("/Users/einere/notes/research.md");
    expect(renderer.container.querySelector(".editor-workspace__status")?.getAttribute("data-status")).toBe("saved");
    expect(renderer.container.textContent).toContain("Saved");
    expect(renderer.container.textContent).toContain("42 words");

    await act(async () => {
      button?.click();
    });

    expect(writeText).toHaveBeenCalledWith("/Users/einere/notes/research.md");
    expect(showToast).toHaveBeenCalledWith(
      "Copied the file path to the clipboard.",
      "success",
    );
  });

  it("shows draft context for unsaved local documents", () => {
    renderer.render(
      <DocumentWorkspaceFooter
        documentStatus={null}
        filePath={null}
        headingCount={0}
        metrics={createMetrics({
          characterCount: 0,
          estimatedReadingMinutes: 0,
          lineCount: 0,
          wordCount: 0,
        })}
      />,
    );

    expect(renderer.container.textContent).toContain("Unsaved local document");
    expect(renderer.container.textContent).toContain("Draft");
    expect(renderer.container.querySelector(".editor-workspace__status")?.getAttribute("data-status")).toBe("initial");
    expect(renderer.container.querySelector(".editor-workspace__path-button")).toBeNull();
  });

  it("shows an error toast when clipboard copy fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("clipboard failed"));
    vi.stubGlobal("navigator", {
      clipboard: { writeText },
    });

    renderer.render(
      <DocumentWorkspaceFooter
        documentStatus="saved"
        filePath="/Users/einere/notes/research.md"
        headingCount={2}
        metrics={createMetrics()}
      />,
    );

    const button = renderer.container.querySelector(".editor-workspace__path-button") as
      | HTMLButtonElement
      | null;

    await act(async () => {
      button?.click();
    });

    expect(showToast).toHaveBeenCalledWith(
      "Could not copy the file path.",
      "error",
    );
  });
});
