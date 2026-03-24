import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  createEditorViewStateStore,
  type EditorViewStateStore,
} from "../lib/editor-view-state-store";

const EditorViewStateContext = createContext<EditorViewStateStore | null>(null);

type EditorViewStateProviderProps = {
  children: ReactNode;
  documentKey: number;
};

export function EditorViewStateProvider({
  children,
  documentKey,
}: EditorViewStateProviderProps) {
  const storeRef = useRef<EditorViewStateStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = createEditorViewStateStore();
  }

  useEffect(() => {
    storeRef.current?.reset();
  }, [documentKey]);

  return (
    <EditorViewStateContext.Provider value={storeRef.current}>
      {children}
    </EditorViewStateContext.Provider>
  );
}

export function useEditorViewStateStore() {
  const store = useContext(EditorViewStateContext);
  if (!store) {
    throw new Error("useEditorViewStateStore must be used within EditorViewStateProvider.");
  }

  return store;
}

export function useEditorViewState() {
  const store = useEditorViewStateStore();
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
}

export function useActiveEditorLine() {
  return useEditorViewState().activeLine;
}
