import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  clampPanelWidth,
  getEffectivePanelWidths,
  getMaxAllowedPanelWidth,
} from "./panel-layout";

export type PanelKind = "preview" | "toc";

type PanelWidthsState = {
  preview: number | null;
  toc: number | null;
};

type UsePanelResizingOptions = {
  containerWidth: number | null;
  hasPreview: boolean;
  hasToc: boolean;
  initialPreviewPanelWidth: number | null;
  initialTocPanelWidth: number | null;
  onPanelWidthsChange: (widths: {
    previewPanelWidth: number | null;
    tocPanelWidth: number | null;
  }) => void;
};

export function usePanelResizing({
  containerWidth,
  hasPreview,
  hasToc,
  initialPreviewPanelWidth,
  initialTocPanelWidth,
  onPanelWidthsChange,
}: UsePanelResizingOptions) {
  const dragStateRef = useRef<{
    initialWidth: number;
    kind: PanelKind;
    pointerId: number;
    startX: number;
  } | null>(null);
  const latestPanelWidthsRef = useRef<PanelWidthsState>({
    preview: initialPreviewPanelWidth,
    toc: initialTocPanelWidth,
  });
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [activeResizer, setActiveResizer] = useState<PanelKind | null>(null);
  const [panelWidths, setPanelWidths] = useState<PanelWidthsState>({
    preview: initialPreviewPanelWidth,
    toc: initialTocPanelWidth,
  });

  useEffect(() => {
    setPanelWidths({
      preview: initialPreviewPanelWidth,
      toc: initialTocPanelWidth,
    });
    latestPanelWidthsRef.current = {
      preview: initialPreviewPanelWidth,
      toc: initialTocPanelWidth,
    };
  }, [initialPreviewPanelWidth, initialTocPanelWidth]);

  const effectivePanelWidths = useMemo(() => {
    return getEffectivePanelWidths({
      containerWidth,
      hasPreview,
      hasToc,
      previewWidth: panelWidths.preview,
      tocWidth: panelWidths.toc,
    });
  }, [
    containerWidth,
    hasPreview,
    hasToc,
    panelWidths.preview,
    panelWidths.toc,
  ]);

  const commitPanelWidths = useEffectEvent((nextPanelWidths: PanelWidthsState) => {
    onPanelWidthsChange({
      previewPanelWidth: nextPanelWidths.preview,
      tocPanelWidth: nextPanelWidths.toc,
    });
  });

  const applyPanelWidth = useEffectEvent((kind: PanelKind, nextWidth: number) => {
    setPanelWidths((current) => {
      const nextPanelWidths = kind === "toc"
        ? { ...current, toc: nextWidth }
        : { ...current, preview: nextWidth };

      latestPanelWidthsRef.current = nextPanelWidths;
      return nextPanelWidths;
    });
  });

  const updatePanelWidths = useEffectEvent((nextPanelWidths: PanelWidthsState) => {
    latestPanelWidthsRef.current = nextPanelWidths;
    setPanelWidths(nextPanelWidths);
  });

  const finalizeResize = useEffectEvent(() => {
    dragStateRef.current = null;
    setActiveResizer(null);
    setLayoutVersion((version) => version + 1);
    commitPanelWidths(latestPanelWidthsRef.current);
  });

  useEffect(() => {
    latestPanelWidthsRef.current = panelWidths;
  }, [panelWidths]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) {
        return;
      }

      const deltaX = event.clientX - dragState.startX;
      const requestedWidth = dragState.kind === "toc"
        ? dragState.initialWidth + deltaX
        : dragState.initialWidth - deltaX;
      const nextWidth = clampPanelWidth(dragState.kind, requestedWidth, {
        containerWidth,
        hasPreview,
        hasToc,
        siblingWidth: dragState.kind === "toc"
          ? effectivePanelWidths.previewWidth
          : effectivePanelWidths.tocWidth,
      });

      applyPanelWidth(dragState.kind, nextWidth);
    };

    const handlePointerUp = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      finalizeResize();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [
    applyPanelWidth,
    containerWidth,
    effectivePanelWidths.previewWidth,
    effectivePanelWidths.tocWidth,
    finalizeResize,
    hasPreview,
    hasToc,
  ]);

  function startResize(kind: PanelKind, event: ReactPointerEvent<HTMLDivElement>) {
    const initialWidth = kind === "toc"
      ? effectivePanelWidths.tocWidth
      : effectivePanelWidths.previewWidth;
    if (initialWidth === null) {
      return;
    }

    dragStateRef.current = {
      initialWidth,
      kind,
      pointerId: event.pointerId,
      startX: event.clientX,
    };
    setActiveResizer(kind);
    event.preventDefault();
  }

  function resizeWithKeyboard(kind: PanelKind, event: ReactKeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 48 : 16;
    const currentWidth = kind === "toc"
      ? effectivePanelWidths.tocWidth
      : effectivePanelWidths.previewWidth;

    if (currentWidth === null) {
      return;
    }

    const siblingWidth = kind === "toc"
      ? effectivePanelWidths.previewWidth
      : effectivePanelWidths.tocWidth;
    const maxWidth = getMaxAllowedPanelWidth({
      containerWidth,
      hasPreview,
      hasToc,
      kind,
      siblingWidth,
    });

    let nextWidth: number | null = null;

    if (event.key === "Home") {
      nextWidth = clampPanelWidth(kind, 0, {
        containerWidth,
        hasPreview,
        hasToc,
        siblingWidth,
      });
    } else if (event.key === "End") {
      nextWidth = maxWidth;
    } else if (kind === "toc" && event.key === "ArrowLeft") {
      nextWidth = currentWidth - step;
    } else if (kind === "toc" && event.key === "ArrowRight") {
      nextWidth = currentWidth + step;
    } else if (kind === "preview" && event.key === "ArrowLeft") {
      nextWidth = currentWidth + step;
    } else if (kind === "preview" && event.key === "ArrowRight") {
      nextWidth = currentWidth - step;
    }

    if (nextWidth === null) {
      return;
    }

    event.preventDefault();

    const clampedWidth = clampPanelWidth(kind, nextWidth, {
      containerWidth,
      hasPreview,
      hasToc,
      siblingWidth,
    });
    const nextPanelWidths = kind === "toc"
      ? { ...panelWidths, toc: clampedWidth }
      : { ...panelWidths, preview: clampedWidth };

    updatePanelWidths(nextPanelWidths);
    setLayoutVersion((version) => version + 1);
    commitPanelWidths(nextPanelWidths);
  }

  return {
    activeResizer,
    effectivePanelWidths,
    isResizingPanels: activeResizer !== null,
    layoutVersion,
    resizeWithKeyboard,
    startResize,
  };
}
