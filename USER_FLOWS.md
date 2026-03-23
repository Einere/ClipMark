# USER_FLOWS

Product: `ClipMark`

## Primary Flow: Archive Web Content

1. The user finds useful content on a web page.
2. The user copies all or part of the page.
3. The user opens the app and creates a new document.
4. The user pastes the content into the editor.
5. The app converts clipboard content into clean Markdown-oriented text.
6. The user reviews the result in the preview panel.
7. The user edits headings, links, lists, quotes, and code blocks as needed.
8. The user uses the table of contents to navigate long sections.
9. The user saves the document as a local `.md` file.

## Secondary Flow: Update an Existing Archive

1. The user opens an existing `.md` file.
2. The app restores the document in the editor and preview layout.
3. The user edits or appends new content.
4. The user verifies structure with the preview and TOC.
5. The user saves changes.

## Tertiary Flow: Prepare a Shareable Output

1. The user finishes editing an archive document.
2. The user checks visual output in preview.
3. The user exports the document as HTML or PDF if supported.
4. The user uses the export for reading, sharing, or reference.

## Important States

- Empty document state
- Loaded document state
- Dirty state with unsaved changes
- Paste conversion in progress
- Conversion fallback state for complex pasted content
- Export ready state

## UX Priorities By Flow

- Web archive flow: paste quality and low friction matter most
- Existing file flow: stability and predictable save behavior matter most
- Export flow: readable output matters more than extensive publishing options
