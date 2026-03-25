# TECH_DECISIONS

Product: `ClipMark`

## Chosen Stack

| Layer | Choice | Reason |
| --- | --- | --- |
| App shell | Tauri | Lightweight desktop shell that supports fast MVP iteration |
| UI | React | Mature ecosystem and smooth integration with editor/rendering libraries |
| Editor | CodeMirror 6 | Modular and well-suited to Markdown-focused editing |
| Markdown rendering | remark + rehype | Flexible AST pipeline for preview and future document processing |
| Paste conversion | Turndown with custom rules | Fastest path to a useful HTML-to-Markdown pipeline |

## Why This Stack

- It favors fast validation without locking the product into Electron-scale overhead
- It supports the app's archive-first workflow with strong paste processing options
- It keeps the document model centered on plain Markdown text

## Architectural Constraints

- Keep the document model as `markdown string + metadata`
- Isolate editor-specific behavior behind an adapter
- Keep rendering behind a dedicated Markdown rendering module
- Keep paste conversion as a staged pipeline:
  - clipboard normalization
  - HTML cleanup
  - HTML to Markdown conversion
  - Markdown post-processing
- Limit Tauri commands to file system and desktop integration concerns

## Expected Future Pressure

- Paste conversion quality may require replacing or augmenting Turndown later
- A stronger macOS-native feel may eventually justify revisiting a native shell
- Export requirements may add a dedicated print or rendering pipeline

## Migration Strategy

### Editor

If the editor ever changes, preserve the app-facing interface:

- `getText()`
- `setText(value)`
- `replaceSelection(value)`
- `focus()`
- `onChange(listener)`
- `scrollToHeading(id)`

### Renderer

Keep preview generation behind a single function boundary:

- `renderMarkdown(markdown): html`

This makes `remark + rehype` replaceable with another rendering stack if needed.

### Paste Pipeline

Keep the converter split by stages so that Turndown can be replaced incrementally instead of all at once.

## Editor Synchronization

### Problem

The initial editor integration pushed `view.state.doc.toString()` into the shared document store on every CodeMirror document change.

That kept the rest of the app simple, but it also meant:

- every keystroke serialized the full CodeMirror document into a string
- preview, TOC, footer metrics, save, and dirty tracking all competed with active typing
- larger Markdown documents paid an O(n) copy cost even when no consumer immediately needed the latest string

### Decision

Keep the app-facing document contract as `markdown string + metadata`, but change the internal store implementation to use:

- a monotonically increasing document revision
- a lazily-read markdown source owned by the editor
- deferred string serialization only when a consumer actually reads markdown

In practice, the editor now connects a source reader to the document store and only notifies the store that the document changed. The store increments its revision immediately, but postpones `doc.toString()` until `getMarkdown()` is called by preview, save, or another consumer.

### Why This Instead Of Full Editor-State Ownership

We considered moving the entire application model to "editor state handle + delayed serialization". That would reduce string-centric assumptions further, but it would also expand the change surface across save flows, tests, document session orchestration, and future non-editor document access.

The chosen design keeps the existing external API shape while removing the hottest serialization path from active typing.

### Consequences

Benefits:

- dirty tracking can react to document changes through revision comparison without forcing full string reads
- the editor no longer serializes the full document on every keystroke
- preview, save, and derived document metrics still read plain markdown when they need it

Trade-offs:

- the store now has hidden internal state beyond the last realized markdown string
- disconnecting or replacing the editor source must flush any pending markdown before the source is dropped
- code that assumes "store update implies markdown string already materialized" is no longer valid

### Guardrails

- `replaceMarkdown` is still used for opened documents, new documents, and explicit external resets
- `getMarkdown()` remains the single boundary that materializes the latest markdown string
- `useDocumentDirty()` compares revisions, not serialized markdown
- editor-driven updates must go through the connected source reader instead of calling `setMarkdown(doc.toString())` on every change
