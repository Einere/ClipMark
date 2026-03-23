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
