import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREVIEW_PANEL_WIDTH_PX,
  DEFAULT_TOC_PANEL_WIDTH_PX,
  MAX_PREVIEW_PANEL_WIDTH_PX,
  MIN_PREVIEW_PANEL_WIDTH_PX,
  MIN_TOC_PANEL_WIDTH_PX,
  clampPanelWidth,
  getEffectivePanelWidths,
  getMaxAllowedPanelWidth,
} from "./panel-layout";

describe("panel-layout", () => {
  it("uses defaults when a panel width preference is missing", () => {
    expect(
      clampPanelWidth("toc", null, {
        containerWidth: 1400,
        hasPreview: true,
        hasToc: true,
        siblingWidth: DEFAULT_PREVIEW_PANEL_WIDTH_PX,
      }),
    ).toBe(DEFAULT_TOC_PANEL_WIDTH_PX);
  });

  it("limits preview width when the editor needs room", () => {
    expect(
      getMaxAllowedPanelWidth({
        containerWidth: 980,
        hasPreview: true,
        hasToc: true,
        kind: "preview",
        siblingWidth: 256,
      }),
    ).toBeLessThan(MAX_PREVIEW_PANEL_WIDTH_PX);
  });

  it("enforces a minimum width for narrow toc panels", () => {
    expect(
      clampPanelWidth("toc", 80, {
        containerWidth: 1200,
        hasPreview: true,
        hasToc: true,
        siblingWidth: 440,
      }),
    ).toBe(MIN_TOC_PANEL_WIDTH_PX);
  });

  it("reclamps both side panels against the available container width", () => {
    expect(
      getEffectivePanelWidths({
        containerWidth: 920,
        hasPreview: true,
        hasToc: true,
        previewWidth: 900,
        tocWidth: 320,
      }),
    ).toEqual({
      previewWidth: MIN_PREVIEW_PANEL_WIDTH_PX,
      tocWidth: 196,
    });
  });
});
