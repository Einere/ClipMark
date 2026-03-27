export const PANEL_RESIZE_HANDLE_WIDTH_PX = 12;
export const DEFAULT_TOC_PANEL_WIDTH_PX = 256;
export const DEFAULT_PREVIEW_PANEL_WIDTH_PX = 440;
export const MIN_TOC_PANEL_WIDTH_PX = 176;
export const MAX_TOC_PANEL_WIDTH_PX = 384;
export const MIN_PREVIEW_PANEL_WIDTH_PX = 280;
export const MAX_PREVIEW_PANEL_WIDTH_PX = 720;
export const MIN_EDITOR_PANEL_WIDTH_PX = 420;

type PanelKind = "toc" | "preview";

type PanelLayoutOptions = {
  containerWidth: number | null;
  hasPreview: boolean;
  hasToc: boolean;
  previewWidth: number | null;
  tocWidth: number | null;
};

type MaxAllowedWidthOptions = {
  containerWidth: number | null;
  hasPreview: boolean;
  hasToc: boolean;
  kind: PanelKind;
  siblingWidth: number | null;
};

function getResolvedPanelWidth(kind: PanelKind, width: number | null) {
  if (width !== null && Number.isFinite(width)) {
    return width;
  }

  return kind === "toc"
    ? DEFAULT_TOC_PANEL_WIDTH_PX
    : DEFAULT_PREVIEW_PANEL_WIDTH_PX;
}

function getPanelBounds(kind: PanelKind) {
  if (kind === "toc") {
    return {
      max: MAX_TOC_PANEL_WIDTH_PX,
      min: MIN_TOC_PANEL_WIDTH_PX,
    };
  }

  return {
    max: MAX_PREVIEW_PANEL_WIDTH_PX,
    min: MIN_PREVIEW_PANEL_WIDTH_PX,
  };
}

export function getMaxAllowedPanelWidth({
  containerWidth,
  hasPreview,
  hasToc,
  kind,
  siblingWidth,
}: MaxAllowedWidthOptions) {
  const { max, min } = getPanelBounds(kind);

  if (containerWidth === null || containerWidth <= 0) {
    return max;
  }

  const visiblePanelCount = Number(hasToc) + Number(hasPreview) + 1;
  const resizeHandleCount = Math.max(visiblePanelCount - 1, 0);
  const reservedHandleWidth = resizeHandleCount * PANEL_RESIZE_HANDLE_WIDTH_PX;
  const siblingReservedWidth = siblingWidth === null ? 0 : siblingWidth;
  const availableWidth =
    containerWidth - MIN_EDITOR_PANEL_WIDTH_PX - reservedHandleWidth - siblingReservedWidth;

  if (availableWidth <= min) {
    return min;
  }

  return Math.min(max, availableWidth);
}

export function clampPanelWidth(
  kind: PanelKind,
  requestedWidth: number | null,
  options: Omit<MaxAllowedWidthOptions, "kind">,
) {
  const { min } = getPanelBounds(kind);
  const resolvedWidth = getResolvedPanelWidth(kind, requestedWidth);
  const maxAllowedWidth = getMaxAllowedPanelWidth({
    ...options,
    kind,
  });

  return Math.max(min, Math.min(maxAllowedWidth, resolvedWidth));
}

export function getEffectivePanelWidths({
  containerWidth,
  hasPreview,
  hasToc,
  previewWidth,
  tocWidth,
}: PanelLayoutOptions) {
  const effectivePreviewWidth = hasPreview
    ? clampPanelWidth("preview", previewWidth, {
        containerWidth,
        hasPreview,
        hasToc,
        siblingWidth: hasToc
          ? clampPanelWidth("toc", tocWidth, {
              containerWidth,
              hasPreview,
              hasToc,
              siblingWidth: null,
            })
          : null,
      })
    : null;

  const effectiveTocWidth = hasToc
    ? clampPanelWidth("toc", tocWidth, {
        containerWidth,
        hasPreview,
        hasToc,
        siblingWidth: effectivePreviewWidth,
      })
    : null;

  const resolvedPreviewWidth = hasPreview
    ? clampPanelWidth("preview", previewWidth, {
        containerWidth,
        hasPreview,
        hasToc,
        siblingWidth: effectiveTocWidth,
      })
    : null;

  return {
    previewWidth: resolvedPreviewWidth,
    tocWidth: effectiveTocWidth,
  };
}
