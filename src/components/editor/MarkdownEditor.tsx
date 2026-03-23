import {
  forwardRef,
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useRef,
} from "react";
import { EditorSelection, EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView, keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { basicSetup } from "codemirror";
import type { DocumentStore } from "../../lib/document-store";
import {
  convertClipboardToMarkdown,
  getClipboardPayload,
} from "../../lib/paste";

type MarkdownEditorProps = {
  documentKey: number;
  onFocusChange?: (isFocused: boolean) => void;
  store: DocumentStore;
};

export type MarkdownEditorHandle = {
  focus: () => void;
  hasFocus: () => boolean;
  focusHeadingLine: (line: number) => void;
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
  "&.cm-focused .cm-activeLine": {
    backgroundColor: "rgba(31, 92, 255, 0.06)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--surface-primary)",
    border: "none",
    color: "var(--text-muted)",
  },
});

export const MarkdownEditor = forwardRef<
  MarkdownEditorHandle,
  MarkdownEditorProps
>(function MarkdownEditor({ documentKey, onFocusChange, store }, ref) {
  const rootRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const lastDocumentKeyRef = useRef(documentKey);
  const onFocusChangeEvent = useEffectEvent((isFocused: boolean) => {
    onFocusChange?.(isFocused);
  });

  useEffect(() => {
    if (!rootRef.current || viewRef.current) {
      return;
    }

    const view = new EditorView({
      parent: rootRef.current,
      state: EditorState.create({
        doc: store.getMarkdown(),
        extensions: [
          basicSetup,
          markdown(),
          keymap.of([indentWithTab]),
          editorTheme,
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              store.setMarkdown(update.state.doc.toString());
            }
          }),
          EditorView.domEventHandlers({
            blur() {
              onFocusChangeEvent(false);
              return false;
            },
            focus() {
              onFocusChangeEvent(true);
              return false;
            },
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
  }, [store]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    if (lastDocumentKeyRef.current === documentKey) {
      return;
    }

    lastDocumentKeyRef.current = documentKey;
    const currentValue = view.state.doc.toString();
    view.dispatch({
      changes: {
        from: 0,
        to: currentValue.length,
        insert: store.getMarkdown(),
      },
      selection: EditorSelection.cursor(0),
      scrollIntoView: true,
    });
    view.focus();
  }, [documentKey, store]);

  useImperativeHandle(ref, () => ({
    focus() {
      viewRef.current?.focus();
    },
    hasFocus() {
      return rootRef.current?.contains(document.activeElement) ?? false;
    },
    focusHeadingLine(line: number) {
      const view = viewRef.current;
      if (!view) {
        return;
      }

      const safeLine = Math.max(1, Math.min(line, view.state.doc.lines));
      const lineInfo = view.state.doc.line(safeLine);
      view.dispatch({
        selection: EditorSelection.cursor(lineInfo.from),
        scrollIntoView: true,
      });
      view.focus();
    },
  }));

  return <div className="editor-root" ref={rootRef} />;
});
