import {
  forwardRef,
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useRef,
} from "react";
import { tags } from "@lezer/highlight";
import { EditorSelection, EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView, keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { basicSetup } from "codemirror";
import type { DocumentStore } from "../../lib/document-store";
import { useEditorViewStateStore } from "../../hooks/useEditorViewState";
import {
  convertClipboardToMarkdown,
  getClipboardPayload,
} from "../../lib/paste";

type MarkdownEditorProps = {
  documentKey: number;
  onFocusChange?: (isFocused: boolean) => void;
  store: DocumentStore;
};

export const markdownEditorHighlightStyle = HighlightStyle.define([
  {
    tag: [tags.link, tags.url],
    color: "var(--color-editor-link)",
  },
]);

export type MarkdownEditorHandle = {
  focus: () => void;
  hasFocus: () => boolean;
  focusHeadingLine: (line: number) => void;
};

export const MarkdownEditor = forwardRef<
  MarkdownEditorHandle,
  MarkdownEditorProps
>(function MarkdownEditor(
  { documentKey, onFocusChange, store },
  ref,
) {
  const editorViewStateStore = useEditorViewStateStore();
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
          syntaxHighlighting(markdownEditorHighlightStyle),
          keymap.of([indentWithTab]),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              store.setMarkdown(update.state.doc.toString());
            }

            if (update.docChanged || update.selectionSet) {
              editorViewStateStore.setActiveLine(
                update.state.doc.lineAt(update.state.selection.main.head).number,
              );
            }

            if (update.focusChanged) {
              const focused = update.view.hasFocus;
              editorViewStateStore.setFocused(focused);
              onFocusChangeEvent(focused);
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
    editorViewStateStore.setActiveLine(
      view.state.doc.lineAt(view.state.selection.main.head).number,
    );
    editorViewStateStore.setFocused(view.hasFocus);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [editorViewStateStore, store]);

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
    editorViewStateStore.setActiveLine(1);
    editorViewStateStore.setFocused(true);
    view.focus();
  }, [documentKey, editorViewStateStore, store]);

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

  return <div className="markdown-editor" ref={rootRef} />;
});
