import { useEffect, useState } from "react";

export type PanelVisibilityState = "closed" | "entering" | "closing" | "open";

function getReducedMotionPreference() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function parseDurationMs(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return 0;
  }

  if (normalized.endsWith("ms")) {
    const parsed = Number(normalized.slice(0, -2));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (normalized.endsWith("s")) {
    const parsed = Number(normalized.slice(0, -1));
    return Number.isFinite(parsed) ? parsed * 1000 : 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getPanelExitTransitionMs() {
  if (typeof window === "undefined" || typeof getComputedStyle !== "function") {
    return 220;
  }

  const rootStyles = getComputedStyle(document.documentElement);
  const durations = [
    rootStyles.getPropertyValue("--duration-panel-width-exit"),
    rootStyles.getPropertyValue("--duration-panel-content-exit"),
    rootStyles.getPropertyValue("--duration-panel-handle-exit"),
  ].map(parseDurationMs);

  return Math.max(...durations, 220);
}

export function usePanelPresence(isVisible: boolean) {
  const [state, setState] = useState<PanelVisibilityState>(isVisible ? "open" : "closed");

  useEffect(() => {
    if (isVisible) {
      setState((current) => {
        if (current === "open") {
          return current;
        }

        return getReducedMotionPreference() ? "open" : "entering";
      });

      if (getReducedMotionPreference()) {
        return;
      }

      const frameId = window.requestAnimationFrame(() => {
        setState("open");
      });

      return () => {
        window.cancelAnimationFrame(frameId);
      };
    }

    if (state === "closed") {
      return;
    }

    setState("closing");

    if (getReducedMotionPreference()) {
      setState("closed");
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setState("closed");
    }, getPanelExitTransitionMs());

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isVisible, state]);

  return {
    isMounted: state !== "closed",
    state,
  };
}
