import { useEffect, useState } from "react";
import type { MenuHandlers, MenuState } from "../lib/menu";
import { setupAppMenu } from "../lib/menu";
import { useStableMenuHandlers } from "./useStableMenuHandlers";

export function useAppMenuController(
  handlers: MenuHandlers,
  state: MenuState,
) {
  const [menuController, setMenuController] = useState<Awaited<ReturnType<typeof setupAppMenu>>>();
  const stableMenuHandlers = useStableMenuHandlers(handlers);

  useEffect(() => {
    let disposed = false;
    let controller: Awaited<ReturnType<typeof setupAppMenu>>;

    void setupAppMenu(stableMenuHandlers).then((nextController) => {
      if (disposed) {
        void nextController?.dispose();
        return;
      }

      controller = nextController;
      setMenuController(nextController);
    });

    return () => {
      disposed = true;
      setMenuController(undefined);
      if (controller) {
        void controller.dispose();
      }
    };
  }, [stableMenuHandlers]);

  useEffect(() => {
    if (!menuController) {
      return;
    }

    void menuController.sync(state);
  }, [menuController, state]);
}
