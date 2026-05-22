import { useEffect, useEffectEvent, useMemo, useRef } from "react";
import { openExternalUri } from "../../lib/external-link";
import { renderPreviewHtml } from "../../lib/preview-renderer";
import {
  findClosestPreviewAnchor,
  getPreviewAnchorKey,
  type PreviewScrollAnchor,
} from "../../lib/preview-scroll";

type MarkdownPreviewProps = {
  markdown: string;
  activeLine: number | null;
  filePath: string | null;
  isAutoScrollEnabled: boolean;
  isExternalMediaAutoLoadEnabled: boolean;
  isLayoutTransitioning?: boolean;
  layoutVersion?: number;
};

type PreviewAnchorElement = PreviewScrollAnchor & {
  element: HTMLElement;
};

type PreviewScrollBehavior = ScrollBehavior;

const MANUAL_SCROLL_SUSPEND_MS = 900;
const PROGRAMMATIC_SCROLL_FALLBACK_MS = 250;

function scrollPreviewTo(
  container: HTMLDivElement,
  top: number,
  behavior: PreviewScrollBehavior,
) {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (typeof container.scrollTo === "function") {
    container.scrollTo({
      behavior: prefersReducedMotion ? "auto" : behavior,
      top,
    });
    return;
  }

  container.scrollTop = top;
}

export function MarkdownPreview({
  activeLine,
  markdown,
  filePath,
  isAutoScrollEnabled,
  isExternalMediaAutoLoadEnabled,
  isLayoutTransitioning = false,
}: MarkdownPreviewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorsRef = useRef<PreviewAnchorElement[]>([]);
  const lastSyncedAnchorKeyRef = useRef<string | null>(null);
  const pendingScrollFrameRef = useRef<number | null>(null);
  const pendingProgrammaticScrollRef = useRef(0);
  const programmaticScrollFallbackTimeoutRef = useRef<number | null>(null);
  const manualScrollSuspendUntilRef = useRef(0);
  const previewHtml = useMemo(() => {
    return renderPreviewHtml({
      filePath,
      isExternalMediaAutoLoadEnabled,
      markdown,
    });
  }, [filePath, isExternalMediaAutoLoadEnabled, markdown]);
  const isManualScrollSuspended = useEffectEvent(() => {
    return Date.now() < manualScrollSuspendUntilRef.current;
  });
  const clearProgrammaticScrollFallback = useEffectEvent(() => {
    if (programmaticScrollFallbackTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(programmaticScrollFallbackTimeoutRef.current);
    programmaticScrollFallbackTimeoutRef.current = null;
  });
  const markProgrammaticScrollPending = useEffectEvent(() => {
    pendingProgrammaticScrollRef.current += 1;
    clearProgrammaticScrollFallback();
    programmaticScrollFallbackTimeoutRef.current = window.setTimeout(() => {
      pendingProgrammaticScrollRef.current = 0;
      programmaticScrollFallbackTimeoutRef.current = null;
    }, PROGRAMMATIC_SCROLL_FALLBACK_MS);
  });
  const consumeProgrammaticScroll = useEffectEvent(() => {
    if (pendingProgrammaticScrollRef.current <= 0) {
      return false;
    }

    pendingProgrammaticScrollRef.current -= 1;
    if (pendingProgrammaticScrollRef.current === 0) {
      clearProgrammaticScrollFallback();
    }

    return true;
  });
  const suspendAutoScrollForManualIntent = useEffectEvent(() => {
    pendingProgrammaticScrollRef.current = 0;
    clearProgrammaticScrollFallback();
    manualScrollSuspendUntilRef.current = Date.now() + MANUAL_SCROLL_SUSPEND_MS;
  });
  const syncPreviewScroll = useEffectEvent(() => {
    if (!isAutoScrollEnabled || activeLine === null || isLayoutTransitioning) {
      return;
    }

    if (isManualScrollSuspended()) {
      return;
    }

    const container = rootRef.current;
    if (!container) {
      return;
    }

    const targetAnchor = findClosestPreviewAnchor(anchorsRef.current, activeLine);
    if (!targetAnchor) {
      return;
    }

    const targetAnchorKey = getPreviewAnchorKey(targetAnchor);
    if (lastSyncedAnchorKeyRef.current === targetAnchorKey) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const targetRect = targetAnchor.element.getBoundingClientRect();
    const visibleTopThreshold = containerRect.top + Math.min(container.clientHeight * 0.18, 72);
    const visibleBottomThreshold = containerRect.bottom - Math.min(container.clientHeight * 0.24, 96);

    if (
      targetRect.top >= visibleTopThreshold &&
      targetRect.top <= visibleBottomThreshold
    ) {
      lastSyncedAnchorKeyRef.current = targetAnchorKey;
      return;
    }

    const preferredOffset = Math.min(container.clientHeight * 0.3, 120);
    const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
    const nextScrollTop = Math.max(
      0,
      Math.min(
        maxScrollTop,
        container.scrollTop + targetRect.top - containerRect.top - preferredOffset,
      ),
    );

    markProgrammaticScrollPending();
    scrollPreviewTo(container, nextScrollTop, "auto");
    lastSyncedAnchorKeyRef.current = targetAnchorKey;
  });
  const cancelPendingPreviewScroll = useEffectEvent(() => {
    if (pendingScrollFrameRef.current === null) {
      return;
    }

    window.cancelAnimationFrame(pendingScrollFrameRef.current);
    pendingScrollFrameRef.current = null;
  });
  const schedulePreviewScroll = useEffectEvent(() => {
    cancelPendingPreviewScroll();
    pendingScrollFrameRef.current = window.requestAnimationFrame(() => {
      pendingScrollFrameRef.current = null;
      syncPreviewScroll();
    });
  });

  useEffect(() => {
    const container = rootRef.current;
    if (!container) {
      anchorsRef.current = [];
      return;
    }

    anchorsRef.current = Array.from(
      container.querySelectorAll<HTMLElement>("[data-source-line-start]"),
    )
      .map((element) => {
        const lineStart = Number(element.dataset.sourceLineStart);
        const lineEnd = Number(element.dataset.sourceLineEnd ?? lineStart);

        if (!Number.isFinite(lineStart) || !Number.isFinite(lineEnd)) {
          return null;
        }

        return {
          element,
          lineEnd,
          lineStart,
        };
      })
      .filter((anchor): anchor is PreviewAnchorElement => anchor !== null);

    schedulePreviewScroll();
  }, [previewHtml, schedulePreviewScroll]);

  useEffect(() => {
    schedulePreviewScroll();
  }, [activeLine, isAutoScrollEnabled, isLayoutTransitioning, schedulePreviewScroll]);

  useEffect(() => {
    return () => {
      cancelPendingPreviewScroll();
      clearProgrammaticScrollFallback();
    };
  }, [cancelPendingPreviewScroll, clearProgrammaticScrollFallback]);

  return (
    <div
      className="markdown-preview"
      ref={rootRef}
      onClick={(event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        const openButton = target.closest<HTMLElement>("[data-preview-open-uri]");
        const openUri = openButton?.dataset.previewOpenUri;
        if (openUri) {
          event.preventDefault();
          void openExternalUri(openUri);
          return;
        }

        const uriElement = target.closest<HTMLElement>("[data-preview-uri]");
        const previewUri = uriElement?.dataset.previewUri;
        if (!previewUri) {
          return;
        }

        event.preventDefault();
        void openExternalUri(previewUri);
      }}
      onAuxClick={(event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        const uriElement = target.closest<HTMLElement>("[data-preview-uri]");
        const previewUri = uriElement?.dataset.previewUri;
        if (!previewUri) {
          return;
        }

        event.preventDefault();
        void openExternalUri(previewUri);
      }}
      onWheel={() => {
        manualScrollSuspendUntilRef.current = Date.now() + MANUAL_SCROLL_SUSPEND_MS;
      }}
      onPointerDown={suspendAutoScrollForManualIntent}
      onTouchStart={suspendAutoScrollForManualIntent}
      onScroll={() => {
        if (consumeProgrammaticScroll()) {
          return;
        }

        manualScrollSuspendUntilRef.current = Date.now() + MANUAL_SCROLL_SUSPEND_MS;
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        const openButton = target.closest<HTMLElement>("[data-preview-open-uri]");
        const openUri = openButton?.dataset.previewOpenUri;
        if (openUri) {
          event.preventDefault();
          void openExternalUri(openUri);
          return;
        }

        const uriElement = target.closest<HTMLElement>("[data-preview-uri]");
        const previewUri = uriElement?.dataset.previewUri;
        if (!previewUri) {
          return;
        }

        event.preventDefault();
        void openExternalUri(previewUri);
      }}
    >
      <div
        className="markdown-preview__content"
        dangerouslySetInnerHTML={{ __html: previewHtml }}
      />
    </div>
  );
}
