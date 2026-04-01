import { useEffect, useRef } from "react";
import type { MenuHandlers, MenuState } from "../lib/menu";
import { setupAppMenu } from "../lib/menu";
import { useStableMenuHandlers } from "./useStableMenuHandlers";

export function useAppMenuController(
  handlers: MenuHandlers,
  state: MenuState,
) {
  const menuControllerRef = useRef<Awaited<ReturnType<typeof setupAppMenu>> | undefined>(undefined);
  const latestStateRef = useRef(state);
  const stableMenuHandlers = useStableMenuHandlers(handlers);

  useEffect(() => {
    latestStateRef.current = state;

    if (!menuControllerRef.current) {
      return;
    }

    void menuControllerRef.current.sync(state);
  }, [state]);

  useEffect(() => {
    let disposed = false;

    void setupAppMenu(stableMenuHandlers).then((nextController) => {
      if (disposed) {
        void nextController?.dispose();
        return;
      }

      menuControllerRef.current = nextController;
      void nextController?.sync(latestStateRef.current);
    });

    return () => {
      disposed = true;
      const controller = menuControllerRef.current;
      menuControllerRef.current = undefined;
      if (controller) {
        void controller.dispose();
      }
    };
  }, [stableMenuHandlers]);
}
