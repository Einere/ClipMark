import { act, useState } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDocumentStore } from "../lib/document-store";
import { useDocumentWorkspaceState } from "./useDocumentWorkspaceState";

type WorkspaceControls = ReturnType<typeof useDocumentWorkspaceState>;

function Harness({
  onReady,
}: {
  onReady: (controls: WorkspaceControls) => void;
}) {
  const [documentStore] = useState(() => createDocumentStore(""));
  const controls = useDocumentWorkspaceState(documentStore);
  onReady(controls);
  return null;
}

describe("useDocumentWorkspaceState", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let controls: WorkspaceControls;

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
  });

  it("applies opened documents and saves metadata with a stable document boundary", async () => {
    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
      }));
    });

    await act(async () => {
      controls.applyOpenedDocument({
        filename: "draft.md",
        markdown: "# Heading",
        path: "/tmp/draft.md",
      });
    });

    expect(controls.isWelcomeVisible).toBe(false);
    expect(controls.filename).toBe("draft.md");
    expect(controls.filePath).toBe("/tmp/draft.md");
    expect(controls.savedRevision).toBe(1);
    expect(controls.editorDocumentKey).toBe(1);

    await act(async () => {
      controls.applySavedDocument({
        filename: "saved.md",
        path: "/tmp/saved.md",
      });
    });

    expect(controls.filename).toBe("saved.md");
    expect(controls.filePath).toBe("/tmp/saved.md");
    expect(controls.savedRevision).toBe(1);
    expect(controls.editorDocumentKey).toBe(1);
  });

  it("creates and closes documents without leaking previous metadata", async () => {
    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
      }));
    });

    await act(async () => {
      controls.createNewDocument();
    });

    expect(controls.isWelcomeVisible).toBe(false);
    expect(controls.filename).toBe("Untitled.md");
    expect(controls.filePath).toBeNull();
    expect(controls.savedRevision).toBe(0);
    expect(controls.editorDocumentKey).toBe(1);

    await act(async () => {
      controls.closeCurrentDocument();
    });

    expect(controls.isWelcomeVisible).toBe(true);
    expect(controls.filename).toBeNull();
    expect(controls.filePath).toBeNull();
    expect(controls.savedRevision).toBe(0);
    expect(controls.editorDocumentKey).toBe(2);
  });
});
