import {
  clampPanelWidth,
  getMaxAllowedPanelWidth,
} from "./panel-layout";

type PanelKind = "preview" | "toc";

type GetPanelResizeHandlePropsOptions = {
  containerWidth: number | null;
  currentWidth: number | null;
  hasPreview: boolean;
  hasToc: boolean;
  isActive: boolean;
  isExpanded: boolean;
  isVisible: boolean;
  kind: PanelKind;
  siblingWidth: number | null;
};

function getResizeHandleLabel(kind: PanelKind) {
  return kind === "toc"
    ? "Resize table of contents panel"
    : "Resize preview panel";
}

export function getPanelResizeHandleProps({
  containerWidth,
  currentWidth,
  hasPreview,
  hasToc,
  isActive,
  isExpanded,
  isVisible,
  kind,
  siblingWidth,
}: GetPanelResizeHandlePropsOptions) {
  return {
    "aria-controls": "editor-workspace-editor-panel",
    "aria-label": getResizeHandleLabel(kind),
    "aria-orientation": "vertical" as const,
    "aria-valuemax": getMaxAllowedPanelWidth({
      containerWidth,
      hasPreview,
      hasToc,
      kind,
      siblingWidth,
    }),
    "aria-valuemin": clampPanelWidth(kind, 0, {
      containerWidth,
      hasPreview,
      hasToc,
      siblingWidth,
    }),
    "aria-valuenow": currentWidth ?? undefined,
    "data-active": isActive,
    "data-expanded": isExpanded,
    "data-panel-resizer": kind,
    role: "separator" as const,
    tabIndex: isVisible ? 0 : -1,
  };
}
