import { describe, expect, it } from "vitest";
import { getPanelResizeHandleProps } from "./panel-resize-handle";

describe("panel-resize-handle", () => {
  it("builds toc separator accessibility props from the current layout", () => {
    expect(getPanelResizeHandleProps({
      containerWidth: 1400,
      currentWidth: 260,
      hasPreview: true,
      hasToc: true,
      isActive: false,
      isExpanded: true,
      isVisible: true,
      kind: "toc",
      siblingWidth: 480,
    })).toEqual({
      "aria-controls": "editor-workspace-editor-panel",
      "aria-label": "Resize table of contents panel",
      "aria-orientation": "vertical",
      "aria-valuemax": 384,
      "aria-valuemin": 176,
      "aria-valuenow": 260,
      "data-active": false,
      "data-expanded": true,
      "data-panel-resizer": "toc",
      role: "separator",
      tabIndex: 0,
    });
  });

  it("makes hidden separators unfocusable while preserving preview bounds", () => {
    expect(getPanelResizeHandleProps({
      containerWidth: 1100,
      currentWidth: 440,
      hasPreview: true,
      hasToc: false,
      isActive: true,
      isExpanded: false,
      isVisible: false,
      kind: "preview",
      siblingWidth: null,
    })).toEqual({
      "aria-controls": "editor-workspace-editor-panel",
      "aria-label": "Resize preview panel",
      "aria-orientation": "vertical",
      "aria-valuemax": 668,
      "aria-valuemin": 280,
      "aria-valuenow": 440,
      "data-active": true,
      "data-expanded": false,
      "data-panel-resizer": "preview",
      role: "separator",
      tabIndex: -1,
    });
  });
});
