import { useEffect, useEffectEvent, useRef } from "react";
import { EditorSelection, EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView, keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { basicSetup } from "codemirror";
import {
  convertClipboardToMarkdown,
  getClipboardPayload,
} from "../../lib/paste";

type MarkdownEditorProps = {
  onChange: (value: string) => void;
  value: string;
};

const editorTheme = EditorView.theme({
  "&": {
    backgroundColor: "var(--surface-primary)",
    color: "var(--text-primary)",
    height: "100%",
  },
  ".cm-scroller": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    lineHeight: "1.55",
    overflow: "auto",
  },
  ".cm-content": {
    caretColor: "var(--accent)",
    padding: "1rem 1.1rem 2rem",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--accent)",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(31, 92, 255, 0.06)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--surface-primary)",
    border: "none",
    color: "var(--text-muted)",
  },
});

export function MarkdownEditor({
  onChange,
  value,
}: MarkdownEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeEvent = useEffectEvent(onChange);

  useEffect(() => {
    if (!rootRef.current || viewRef.current) {
      return;
    }

    const view = new EditorView({
      parent: rootRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          markdown(),
          keymap.of([indentWithTab]),
          editorTheme,
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeEvent(update.state.doc.toString());
            }
          }),
          EditorView.domEventHandlers({
            paste(event, currentView) {
              const clipboardData = event.clipboardData;
              if (!clipboardData) {
                return false;
              }

              const payload = getClipboardPayload(clipboardData);
              const markdownText = convertClipboardToMarkdown(payload);
              if (markdownText === null) {
                return false;
              }

              event.preventDefault();
              currentView.dispatch(
                currentView.state.replaceSelection(markdownText),
              );

              return true;
            },
          }),
        ],
      }),
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [onChangeEvent, value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    const currentValue = view.state.doc.toString();
    if (currentValue === value) {
      return;
    }

    view.dispatch({
      changes: {
        from: 0,
        to: currentValue.length,
        insert: value,
      },
      selection: EditorSelection.cursor(0),
    });
  }, [value]);

  return <div className="editor-root" ref={rootRef} />;
}
