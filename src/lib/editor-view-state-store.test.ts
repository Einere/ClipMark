import { describe, expect, it, vi } from "vitest";
import { createEditorViewStateStore } from "./editor-view-state-store";

describe("editor-view-state-store", () => {
  it("tracks active line and focus changes", () => {
    const store = createEditorViewStateStore();

    store.setActiveLine(18);
    store.setFocused(true);

    expect(store.getSnapshot()).toEqual({
      activeLine: 18,
      isFocused: true,
    });
  });

  it("notifies subscribers only when the snapshot changes", () => {
    const store = createEditorViewStateStore();
    const listener = vi.fn();

    const unsubscribe = store.subscribe(listener);
    store.setActiveLine(1);
    store.setFocused(false);
    store.setActiveLine(4);
    store.setFocused(true);
    unsubscribe();
    store.reset();

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
