# PASTE_RULES

Product: `ClipMark`

## Goal

Transform externally copied content into a clean Markdown draft that preserves useful structure while discarding irrelevant styling.

## Core Principles

- Prefer semantic structure over visual fidelity
- Preserve links, lists, headings, quotes, and code whenever possible
- Remove styling noise that does not matter in Markdown
- Avoid destructive conversions on ambiguous content
- Produce output that is easy to edit by hand

## Clipboard Source Priority

1. HTML
2. RTF
3. Plain text

## Block Conversion Rules

| Source | Target |
| --- | --- |
| `h1` to `h6` | `#` to `######` headings |
| `p` | paragraph |
| `blockquote` | `>` blockquote |
| `pre > code` | fenced code block |
| `ul` | `-` list |
| `ol` | numbered list |
| nested lists | preserve indentation |
| `hr` | `---` |

## Inline Conversion Rules

| Source | Target |
| --- | --- |
| `strong`, `b` | `**text**` |
| `em`, `i` | `*text*` |
| `code` | inline code |
| `a` | Markdown link |
| `del`, `s` | strikethrough |

## Preserve

- Heading hierarchy
- Link URLs
- Basic list nesting
- Code blocks
- `details/summary` blocks when present
- Simple tables when safe to convert

## Remove

- Inline style attributes
- Font size and color information
- Layout-oriented wrappers without semantic value
- Buttons, forms, and most interactive controls
- Decorative badges and ad-like fragments when safely detectable

## Table Policy

- Convert simple tables to Markdown tables
- Preserve complex tables as HTML if `rowspan` or `colspan` makes Markdown unsafe
- Prefer safe preservation over broken conversion

## Image Policy

- Convert external image URLs to Markdown image syntax when source URLs are available
- Defer clipboard binary image paste handling until image storage policy is defined
- Do not silently invent local file paths

## Toggle Policy

- Treat blockquote syntax as blockquote only
- Preserve `details/summary` as the standard fold/unfold mechanism
- Do not introduce custom toggle syntax in MVP

## Fallback Rules

- If semantic structure is clear, convert to Markdown
- If structure is unclear but text is valuable, preserve readable text
- If a fragment is structurally rich and conversion is unsafe, preserve as HTML

## Post-Processing Rules

- Normalize extra blank lines
- Normalize list spacing
- Prefer fenced code blocks over indentation-based code blocks
- Keep output human-editable rather than overly normalized

## Example Outcome

Expected transformation target:

````md
# Article Title

Introductory paragraph with a [source link](https://example.com).

## Key Points

- First point
- Second point
  - Nested detail

## Example

```js
console.log("hello")
```
````
