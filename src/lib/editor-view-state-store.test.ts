import { describe, expect, it, vi } from "vitest";
import { createEditorViewStateStore } from "./editor-view-state-store";

describe("editor-view-state-store", () => {
  it("tracks active line and focus changes", () => {
    const store = createEditorViewStateStore();

    store.setActiveLine(18);
    store.setFocused(true);

    expect(store.getSnapshot()).toEqual({
      editSequence: 1,
      activeLine: 18,
      isFocused: true,
    });
  });

  it("counts cursor actions even on the same line without counting focus changes twice", () => {
    const store = createEditorViewStateStore();
    const listener = vi.fn();

    const unsubscribe = store.subscribe(listener);
    store.setActiveLine(1);
    store.setFocused(false);
    store.setActiveLine(4);
    store.setFocused(true);
    unsubscribe();
    store.reset();

    expect(listener).toHaveBeenCalledTimes(3);
  });
});
