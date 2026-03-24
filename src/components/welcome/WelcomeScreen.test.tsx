import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WelcomeScreen } from "./WelcomeScreen";

describe("WelcomeScreen", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

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

  it("renders the Stitch-inspired hero copy and recent file list", async () => {
    await act(async () => {
      root.render(
        createElement(WelcomeScreen, {
          onNew: () => undefined,
          onOpen: () => undefined,
          onOpenRecent: () => undefined,
          recentFiles: [
            { filename: "quarterly_report.md", path: "/docs/quarterly_report.md" },
            { filename: "meeting_notes.md", path: "/docs/meeting_notes.md" },
          ],
        }),
      );
    });

    const normalizedText = container.textContent?.replace(/\s+/g, " ").trim() ?? "";

    expect(normalizedText).toContain("Open a recent archive or start a new Markdown file.");
    expect(container.textContent).toContain(
      "ClipMark is a lightweight Markdown workspace for saving web research into local files. Move from paste to cleanup, preview, and focused writing without leaving the file-first flow.",
    );
    expect(container.textContent).toContain("Open Existing File");
    expect(container.textContent).toContain("quarterly_report.md");
    expect(container.textContent).toContain("/docs/meeting_notes.md");
    expect(container.textContent).toContain("2 files");
    expect(container.textContent).toContain("v0.1.0");
    expect(container.textContent).toContain("© 2026 ClipMark");
    expect(container.textContent).not.toContain("Latest");
    expect(container.querySelectorAll("section")).toHaveLength(2);
    expect(container.querySelector("nav[aria-label='Welcome actions']")).not.toBeNull();
    expect(container.querySelectorAll("ul > li")).toHaveLength(2);
  });

  it("dispatches each welcome action", async () => {
    const onNew = vi.fn();
    const onOpen = vi.fn();
    const onOpenRecent = vi.fn();

    await act(async () => {
      root.render(
        createElement(WelcomeScreen, {
          onNew,
          onOpen,
          onOpenRecent,
          recentFiles: [
            { filename: "quarterly_report.md", path: "/docs/quarterly_report.md" },
          ],
        }),
      );
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const newButton = buttons.find((button) => button.textContent?.includes("New Markdown File"));
    const openButton = buttons.find((button) => button.textContent?.includes("Open Existing File"));
    const recentButton = buttons.find((button) => button.textContent?.includes("quarterly_report.md"));

    await act(async () => {
      newButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      openButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      recentButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onNew).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpenRecent).toHaveBeenCalledWith("/docs/quarterly_report.md");
  });

  it("shows the empty recent state when no files are available", async () => {
    await act(async () => {
      root.render(
        createElement(WelcomeScreen, {
          onNew: () => undefined,
          onOpen: () => undefined,
          onOpenRecent: () => undefined,
          recentFiles: [],
        }),
      );
    });

    expect(container.textContent).toContain("No recent files yet.");
    expect(container.textContent).toContain("Ready");
    expect(container.querySelectorAll("button")).toHaveLength(2);
  });

  it("uses the shared squircle radius class for rounded welcome surfaces", async () => {
    await act(async () => {
      root.render(
        createElement(WelcomeScreen, {
          onNew: () => undefined,
          onOpen: () => undefined,
          onOpenRecent: () => undefined,
          recentFiles: [],
        }),
      );
    });

    const decorativeGlows = container.querySelectorAll("main > div[aria-hidden='true']");
    const recentFilesCard = container.querySelector("article");
    const emptyStateCard = Array.from(container.querySelectorAll("p")).find((element) =>
      element.textContent?.includes("No recent files yet."),
    );

    expect(decorativeGlows).toHaveLength(2);
    expect(Array.from(decorativeGlows).every((element) => element.className.includes("radius-squircle"))).toBe(true);
    expect(recentFilesCard?.className).toContain("radius-squircle");
    expect(emptyStateCard?.className).toContain("radius-squircle");
  });

  it("keeps the decorative background glows broad enough to separate the recent files card", async () => {
    await act(async () => {
      root.render(
        createElement(WelcomeScreen, {
          onNew: () => undefined,
          onOpen: () => undefined,
          onOpenRecent: () => undefined,
          recentFiles: [],
        }),
      );
    });

    const decorativeGlows = Array.from(
      container.querySelectorAll<HTMLDivElement>("main > div[aria-hidden='true']"),
    );

    expect(decorativeGlows).toHaveLength(2);
    expect(decorativeGlows[0]?.className).toContain("size-[32rem]");
    expect(decorativeGlows[0]?.className).toContain("opacity-[0.16]");
    expect(decorativeGlows[0]?.className).toContain("blur-[110px]");
    expect(decorativeGlows[1]?.className).toContain("size-[34rem]");
    expect(decorativeGlows[1]?.className).toContain("opacity-[0.18]");
    expect(decorativeGlows[1]?.className).toContain("blur-[120px]");
  });
});
