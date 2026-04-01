import type { PanelVisibilityState } from "./usePanelPresence";

type PanelPresenceSnapshot = {
  isMounted: boolean;
  state: PanelVisibilityState;
};

type PanelDisplayState = {
  hasRenderedPreview: boolean;
  hasRenderedToc: boolean;
  isPanelLayoutTransitioning: boolean;
  isPreviewExpanded: boolean;
  isTocExpanded: boolean;
};

function isExpanded(
  isVisible: boolean,
  presence: PanelPresenceSnapshot,
) {
  return isVisible && presence.state !== "entering";
}

function isTransitioning(presence: PanelPresenceSnapshot) {
  return presence.state === "entering" || presence.state === "closing";
}

export function getPanelDisplayState({
  isPreviewVisible,
  isTocVisible,
  previewPresence,
  tocPresence,
}: {
  isPreviewVisible: boolean;
  isTocVisible: boolean;
  previewPresence: PanelPresenceSnapshot;
  tocPresence: PanelPresenceSnapshot;
}): PanelDisplayState {
  return {
    hasRenderedPreview: previewPresence.isMounted,
    hasRenderedToc: tocPresence.isMounted,
    isPanelLayoutTransitioning:
      isTransitioning(previewPresence) || isTransitioning(tocPresence),
    isPreviewExpanded: isExpanded(isPreviewVisible, previewPresence),
    isTocExpanded: isExpanded(isTocVisible, tocPresence),
  };
}
