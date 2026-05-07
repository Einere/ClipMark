import { useEffect, useEffectEvent } from "react";

type UseWindowShortcutsOptions = {
  onNew: () => void;
  onOpen: () => void;
  onSave: (saveAs?: boolean) => void;
};

export function useWindowShortcuts({
  onNew,
  onOpen,
  onSave,
}: UseWindowShortcutsOptions) {
  const handleWindowShortcuts = useEffectEvent((event: KeyboardEvent) => {
    const hasModifier = event.metaKey || event.ctrlKey;
    if (!hasModifier) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === "n") {
      event.preventDefault();
      onNew();
      return;
    }

    if (key === "o") {
      event.preventDefault();
      onOpen();
      return;
    }

    if (key === "s") {
      event.preventDefault();
      onSave(event.shiftKey);
    }
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      handleWindowShortcuts(event);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleWindowShortcuts]);
}
