import { useEffect, useRef } from "react";
import type { MenuHandlers, MenuState } from "../lib/menu";
import { setupAppMenu } from "../lib/menu";
import { useStableMenuHandlers } from "./useStableMenuHandlers";

export function useAppMenuController(
  handlers: MenuHandlers,
  state: MenuState,
  isMenuOwner = true,
) {
  const menuControllerRef = useRef<Awaited<ReturnType<typeof setupAppMenu>> | undefined>(undefined);
  const isMenuOwnerRef = useRef(isMenuOwner);
  const latestStateRef = useRef(state);
  const stableMenuHandlers = useStableMenuHandlers(handlers);

  useEffect(() => {
    isMenuOwnerRef.current = isMenuOwner;
    latestStateRef.current = state;

    if (!isMenuOwner || !menuControllerRef.current) {
      return;
    }

    void menuControllerRef.current.sync(state);
  }, [isMenuOwner, state]);

  useEffect(() => {
    let disposed = false;

    void setupAppMenu(stableMenuHandlers).then((nextController) => {
      if (disposed) {
        void nextController?.dispose();
        return;
      }

      menuControllerRef.current = nextController;
      if (isMenuOwnerRef.current) {
        void nextController?.sync(latestStateRef.current);
      }
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
