import { describe, expect, it } from "vitest";
import {
  designSystem,
  getButtonClasses,
  getStatusClasses,
  getToastClasses,
  getWorkspaceLayoutClasses,
} from "./design-system";

describe("design-system", () => {
  it("returns the expected utility bundle for each workspace layout", () => {
    expect(
      getWorkspaceLayoutClasses({
        isPreviewVisible: true,
        isTocVisible: true,
      }),
    ).toContain("xl:grid-cols-[minmax(14rem,15rem)_minmax(0,1.08fr)_minmax(21.25rem,0.88fr)]");

    expect(
      getWorkspaceLayoutClasses({
        isPreviewVisible: false,
        isTocVisible: true,
      }),
    ).toContain("xl:grid-cols-[minmax(14rem,15rem)_minmax(0,1fr)]");

    expect(
      getWorkspaceLayoutClasses({
        isPreviewVisible: false,
        isTocVisible: false,
      }),
    ).toBe(`${designSystem.workspaceBase} ${designSystem.workspaceLayouts.editorOnly}`);
  });

  it("returns semantic button classes for each tone", () => {
    expect(getButtonClasses("primary")).toContain("[background-image:var(--button-primary-fill)]");
    expect(getButtonClasses("primary")).toContain("text-on-primary");
    expect(getButtonClasses("secondary")).toContain("bg-surface-container-high");
    expect(getButtonClasses("secondary")).toContain("focus-visible:outline-focus-glow");
  });

  it("returns status and toast classes with the expected tone modifiers", () => {
    expect(getStatusClasses()).toBe(designSystem.status);
    expect(getStatusClasses(true)).toContain("text-warning");
    expect(getToastClasses("info")).toContain("text-on-surface");
    expect(getToastClasses("error")).toContain("bg-error");
    expect(getToastClasses("error")).toContain("text-on-error");
  });
});
