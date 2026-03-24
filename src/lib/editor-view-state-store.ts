type EditorViewState = {
  activeLine: number | null;
  isFocused: boolean;
};

type Listener = () => void;

export type EditorViewStateStore = {
  getSnapshot: () => EditorViewState;
  reset: () => void;
  setActiveLine: (line: number | null) => void;
  setFocused: (focused: boolean) => void;
  subscribe: (listener: Listener) => () => void;
};

const DEFAULT_EDITOR_VIEW_STATE: EditorViewState = {
  activeLine: 1,
  isFocused: false,
};

export function createEditorViewStateStore(
  initialState: Partial<EditorViewState> = {},
): EditorViewStateStore {
  let state: EditorViewState = {
    ...DEFAULT_EDITOR_VIEW_STATE,
    ...initialState,
  };
  const listeners = new Set<Listener>();

  function emit() {
    listeners.forEach((listener) => listener());
  }

  function updateState(nextState: EditorViewState) {
    if (
      state.activeLine === nextState.activeLine &&
      state.isFocused === nextState.isFocused
    ) {
      return;
    }

    state = nextState;
    emit();
  }

  return {
    getSnapshot() {
      return state;
    },
    reset() {
      updateState(DEFAULT_EDITOR_VIEW_STATE);
    },
    setActiveLine(activeLine) {
      updateState({
        ...state,
        activeLine,
      });
    },
    setFocused(isFocused) {
      updateState({
        ...state,
        isFocused,
      });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
