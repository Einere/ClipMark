import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentWorkspaceFooter } from "./DocumentWorkspaceFooter";

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
  });

  afterEach(() => {
    renderer.cleanup();
  });

  it("renders saved document metadata and copies the current path on click", () => {
    const onPathCopy = vi.fn();

    renderer.render(
      <DocumentWorkspaceFooter
        documentStatus="saved"
        filePath="/Users/einere/notes/research.md"
        headingCount={2}
        metrics={createMetrics()}
        onPathCopy={onPathCopy}
      />,
    );

    const button = renderer.container.querySelector(".editor-workspace__path-button") as
      | HTMLButtonElement
      | null;

    expect(button?.textContent).toContain("/Users/einere/notes/research.md");
    expect(renderer.container.querySelector(".editor-workspace__status")?.getAttribute("data-status")).toBe("saved");
    expect(renderer.container.textContent).toContain("Saved");
    expect(renderer.container.textContent).toContain("42 words");

    act(() => {
      button?.click();
    });

    expect(onPathCopy).toHaveBeenCalledTimes(1);
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
        onPathCopy={() => undefined}
      />,
    );

    expect(renderer.container.textContent).toContain("Unsaved local document");
    expect(renderer.container.textContent).toContain("Draft");
    expect(renderer.container.querySelector(".editor-workspace__status")?.getAttribute("data-status")).toBe("initial");
    expect(renderer.container.querySelector(".editor-workspace__path-button")).toBeNull();
  });
});
