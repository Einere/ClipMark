import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDocumentSessionFileEffects } from "./useDocumentSessionFileEffects";

const {
  logDebug,
  registerWindowDocumentPath,
  registerWindowUntitledDocument,
  registerWindowWelcome,
} = vi.hoisted(() => ({
  logDebug: vi.fn(),
  registerWindowDocumentPath: vi.fn(),
  registerWindowUntitledDocument: vi.fn(),
  registerWindowWelcome: vi.fn(),
}));

vi.mock("../lib/document-window", () => ({
  registerWindowDocumentPath: (path: string | null) =>
    registerWindowDocumentPath(path),
  registerWindowUntitledDocument: () => registerWindowUntitledDocument(),
  registerWindowWelcome: () => registerWindowWelcome(),
}));

vi.mock("../lib/debug-log", () => ({
  logDebug,
}));

type Controls = ReturnType<typeof useDocumentSessionFileEffects>;

function Harness({
  onReady,
  overrides,
}: {
  onReady: (controls: Controls) => void;
  overrides?: Partial<Parameters<typeof useDocumentSessionFileEffects>[0]>;
}) {
  const controls = useDocumentSessionFileEffects({
    applySavedDocumentToWorkspace: vi.fn(),
    applyWorkspaceDocument: vi.fn(),
    forgetRecentFile: vi.fn(),
    onError: vi.fn(),
    onInfo: vi.fn(),
    rememberRecentFile: vi.fn(),
    ...overrides,
  });

  onReady(controls);
  return null;
}

describe("useDocumentSessionFileEffects", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let controls: Controls;

  beforeEach(() => {
    logDebug.mockReset();
    registerWindowDocumentPath.mockReset();
    registerWindowDocumentPath.mockResolvedValue(undefined);
    registerWindowUntitledDocument.mockReset();
    registerWindowUntitledDocument.mockResolvedValue(undefined);
    registerWindowWelcome.mockReset();
    registerWindowWelcome.mockResolvedValue(undefined);
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

  it("applies opened documents and remembers the recent file path together", async () => {
    const applyWorkspaceDocument = vi.fn();
    const rememberRecentFile = vi.fn();

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          applyWorkspaceDocument,
          rememberRecentFile,
        },
      }));
    });

    const document = {
      filename: "draft.md",
      markdown: "# Heading",
      path: "/tmp/draft.md",
    };

    await act(async () => {
      controls.applyOpenedDocument(document);
    });

    expect(applyWorkspaceDocument).toHaveBeenCalledWith(document);
    expect(rememberRecentFile).toHaveBeenCalledWith("/tmp/draft.md");
    expect(registerWindowDocumentPath).toHaveBeenCalledWith("/tmp/draft.md");
  });

  it("applies saved metadata and remembers the saved path together", async () => {
    const applySavedDocumentToWorkspace = vi.fn();
    const rememberRecentFile = vi.fn();

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          applySavedDocumentToWorkspace,
          rememberRecentFile,
        },
      }));
    });

    const saved = {
      filename: "saved.md",
      path: "/tmp/saved.md",
    };

    await act(async () => {
      controls.applySavedDocument(saved);
    });

    expect(applySavedDocumentToWorkspace).toHaveBeenCalledWith(saved);
    expect(rememberRecentFile).toHaveBeenCalledWith("/tmp/saved.md");
    expect(registerWindowDocumentPath).toHaveBeenCalledWith("/tmp/saved.md");
  });

  it("registers the current window as an untitled document", async () => {
    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
      }));
    });

    await act(async () => {
      controls.registerCurrentWindowAsUntitledDocument();
    });

    expect(registerWindowUntitledDocument).toHaveBeenCalledTimes(1);
  });

  it("registers the current window as welcome", async () => {
    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
      }));
    });

    await act(async () => {
      controls.registerCurrentWindowAsWelcome();
    });

    expect(registerWindowWelcome).toHaveBeenCalledTimes(1);
  });

  it("logs and consumes window registration failures", async () => {
    const applySavedDocumentToWorkspace = vi.fn();
    const applyWorkspaceDocument = vi.fn();

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          applySavedDocumentToWorkspace,
          applyWorkspaceDocument,
        },
      }));
    });

    registerWindowDocumentPath.mockRejectedValue(new Error("registry offline"));
    registerWindowUntitledDocument.mockRejectedValue(new Error("registry offline"));
    registerWindowWelcome.mockRejectedValue(new Error("registry offline"));

    const openedDocument = {
      filename: "draft.md",
      markdown: "# Heading",
      path: "/tmp/draft.md",
    };

    await act(async () => {
      controls.applyOpenedDocument(openedDocument);
      await Promise.resolve();
    });

    const savedDocument = {
      filename: "saved.md",
      path: "/tmp/saved.md",
    };

    await act(async () => {
      controls.applySavedDocument(savedDocument);
      await Promise.resolve();
    });

    await act(async () => {
      controls.registerCurrentWindowAsUntitledDocument();
      controls.registerCurrentWindowAsWelcome();
      await Promise.resolve();
    });

    expect(applyWorkspaceDocument).toHaveBeenCalledWith(openedDocument);
    expect(applySavedDocumentToWorkspace).toHaveBeenCalledWith(savedDocument);
    expect(registerWindowDocumentPath).toHaveBeenCalledWith("/tmp/draft.md");
    expect(registerWindowDocumentPath).toHaveBeenCalledWith("/tmp/saved.md");
    expect(registerWindowUntitledDocument).toHaveBeenCalledTimes(1);
    expect(registerWindowWelcome).toHaveBeenCalledTimes(1);
    expect(logDebug).toHaveBeenCalledTimes(4);
    expect(logDebug).toHaveBeenNthCalledWith(
      1,
      "window:registerDocumentPath failed path=/tmp/draft.md error=Error: registry offline",
    );
    expect(logDebug).toHaveBeenNthCalledWith(
      2,
      "window:registerDocumentPath failed path=/tmp/saved.md error=Error: registry offline",
    );
    expect(logDebug).toHaveBeenNthCalledWith(
      3,
      "window:registerUntitledDocument failed error=Error: registry offline",
    );
    expect(logDebug).toHaveBeenNthCalledWith(
      4,
      "window:registerWelcome failed error=Error: registry offline",
    );
  });

  it("forgets missing recent files and reports the error message", async () => {
    const forgetRecentFile = vi.fn();
    const onError = vi.fn();

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          forgetRecentFile,
          onError,
        },
      }));
    });

    await act(async () => {
      controls.handleMissingRecentFile("/tmp/missing.md");
    });

    expect(forgetRecentFile).toHaveBeenCalledWith("/tmp/missing.md");
    expect(onError).toHaveBeenCalledWith(
      "This recent file could not be found and was removed from the list.",
    );
  });

  it("reports when recent files are unavailable in the current environment", async () => {
    const onInfo = vi.fn();

    await act(async () => {
      root.render(createElement(Harness, {
        onReady: (nextControls) => {
          controls = nextControls;
        },
        overrides: {
          onInfo,
        },
      }));
    });

    await act(async () => {
      controls.handleUnavailableRecentFile();
    });

    expect(onInfo).toHaveBeenCalledWith(
      "Recent files are only available in the desktop app.",
    );
  });
});
