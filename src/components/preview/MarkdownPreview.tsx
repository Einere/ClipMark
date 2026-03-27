import { useEffect, useEffectEvent, useMemo, useRef } from "react";
import { openExternalUri } from "../../lib/external-link";
import { renderPreviewHtml } from "../../lib/preview-renderer";
import {
  findClosestPreviewAnchor,
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

function scrollPreviewTo(container: HTMLDivElement, top: number) {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (typeof container.scrollTo === "function") {
    container.scrollTo({
      behavior: prefersReducedMotion ? "auto" : "smooth",
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
  layoutVersion = 0,
}: MarkdownPreviewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorsRef = useRef<PreviewAnchorElement[]>([]);
  const lastSyncedLineRef = useRef<number | null>(null);
  const previewHtml = useMemo(() => {
    return renderPreviewHtml({
      filePath,
      isExternalMediaAutoLoadEnabled,
      markdown,
    });
  }, [filePath, isExternalMediaAutoLoadEnabled, markdown]);
  const syncPreviewScroll = useEffectEvent(() => {
    if (!isAutoScrollEnabled || activeLine === null || isLayoutTransitioning) {
      return;
    }

    const container = rootRef.current;
    if (!container) {
      return;
    }

    const targetAnchor = findClosestPreviewAnchor(anchorsRef.current, activeLine);
    if (!targetAnchor || lastSyncedLineRef.current === activeLine) {
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
      lastSyncedLineRef.current = activeLine;
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

    scrollPreviewTo(container, nextScrollTop);
    lastSyncedLineRef.current = activeLine;
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

    lastSyncedLineRef.current = null;
    syncPreviewScroll();
  }, [isLayoutTransitioning, previewHtml, syncPreviewScroll]);

  useEffect(() => {
    syncPreviewScroll();
  }, [activeLine, isAutoScrollEnabled, isLayoutTransitioning, syncPreviewScroll]);

  useEffect(() => {
    const container = rootRef.current;
    if (!container || typeof ResizeObserver === "undefined" || isLayoutTransitioning) {
      return;
    }

    const observer = new ResizeObserver(() => {
      lastSyncedLineRef.current = null;
      syncPreviewScroll();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [isLayoutTransitioning, syncPreviewScroll]);

  useEffect(() => {
    lastSyncedLineRef.current = null;
    syncPreviewScroll();
  }, [isLayoutTransitioning, layoutVersion, syncPreviewScroll]);

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
