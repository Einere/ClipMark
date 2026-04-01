import { describe, expect, it } from "vitest";
import { getPanelDisplayState } from "./panel-display-state";

describe("panel-display-state", () => {
  it("marks entering panels as rendered but not expanded", () => {
    expect(getPanelDisplayState({
      isPreviewVisible: true,
      isTocVisible: true,
      previewPresence: {
        isMounted: true,
        state: "entering",
      },
      tocPresence: {
        isMounted: true,
        state: "entering",
      },
    })).toEqual({
      hasRenderedPreview: true,
      hasRenderedToc: true,
      isPanelLayoutTransitioning: true,
      isPreviewExpanded: false,
      isTocExpanded: false,
    });
  });

  it("marks open panels as expanded without a layout transition", () => {
    expect(getPanelDisplayState({
      isPreviewVisible: true,
      isTocVisible: false,
      previewPresence: {
        isMounted: true,
        state: "open",
      },
      tocPresence: {
        isMounted: false,
        state: "closed",
      },
    })).toEqual({
      hasRenderedPreview: true,
      hasRenderedToc: false,
      isPanelLayoutTransitioning: false,
      isPreviewExpanded: true,
      isTocExpanded: false,
    });
  });

  it("keeps closing panels rendered and transitioning while hidden", () => {
    expect(getPanelDisplayState({
      isPreviewVisible: false,
      isTocVisible: false,
      previewPresence: {
        isMounted: true,
        state: "closing",
      },
      tocPresence: {
        isMounted: true,
        state: "closing",
      },
    })).toEqual({
      hasRenderedPreview: true,
      hasRenderedToc: true,
      isPanelLayoutTransitioning: true,
      isPreviewExpanded: false,
      isTocExpanded: false,
    });
  });
});
