# PRD

## Product

- Product name: `ClipMark`
- One-line definition: A lightweight Markdown editor optimized for archiving web content into local `.md` files.
- Platform: macOS first
- Technical direction: `Tauri + React + CodeMirror 6 + remark/rehype + Turndown`

## Problem

Existing Markdown editors are often optimized for people who already write Markdown fluently. They are less optimized for the workflow of copying content from the web, cleaning it up, preserving structure, and saving it as a local Markdown file. Rich document tools solve some of that import problem, but they tend to be heavier, file-hostile, or overly WYSIWYG.

## Target Users

- Developer-friendly users who already work with Markdown files
- Users who archive web content for research, notes, references, or drafts
- Users who prefer local files over cloud-native document systems

## Core Value

- Fast startup and responsive editing
- Clear split between text editing and rendered preview
- High-quality paste conversion from web content into Markdown
- File-first workflow with minimal UI overhead

## Product Principles

- This is not a general-purpose writing suite.
- This is not a WYSIWYG editor.
- The file belongs to the user, not the app.
- Structure matters more than visual styling.
- Speed and clarity are more important than feature breadth.

## Goals

- Make `copy from web -> paste -> clean up -> preview -> save` feel fast and reliable
- Preserve useful document structure when importing content
- Keep the app lightweight enough to feel like an information appliance

## Non-Goals

- Real-time collaboration
- Login or cloud sync
- Notion-style block editing
- Database-style document management
- Plugin ecosystem
- AI-assisted writing

## MVP Scope

### Must Have

- Create a new Markdown document
- Open an existing `.md` file
- Save and Save As
- Split layout with editor and preview
- Table of contents panel based on headings
- GitHub Flavored Markdown rendering
- `details/summary` rendering support
- Paste from external apps and browsers
- Convert pasted content into Markdown-friendly output
- Keyboard shortcuts for common file actions
- Dirty state indicator for unsaved changes

### Should Have

- In-document search
- Code block syntax highlighting in preview
- Toggle controls for TOC and preview panels
- HTML export
- PDF export

### Later

- Multi-tab editing
- Folder library or workspace browser
- Tags and metadata management
- Image asset management
- Web clipper

## Success Criteria

- The app feels ready to type within a very short time after launch
- Paste conversion usually produces a usable Markdown draft without major cleanup
- Large Markdown documents remain comfortable to edit and preview
- The file workflow stays obvious and predictable

## Risks

- Paste conversion quality may define product perception more than the editor itself
- Complex tables and interactive web layouts may degrade poorly if conversion rules are too aggressive
- Overbuilding general editor features could dilute the archive-first value proposition

## Open Decisions

- Final product name
- Whether HTML export ships in MVP or immediately after
- Whether image binary paste is supported in MVP or postponed
