# Color Token Specification

## Purpose

This document defines how color tokens must be authored and consumed in ClipMark.
The goal is consistency for developers, not unrestricted stylistic freedom.

## Token Layers

### 1. Primitive tokens

Primitive tokens are the only tokens allowed to carry raw color coordinates.

- Prefix examples: `--slate-*`, `--blue-*`, `--red-*`
- Allowed syntax: `oklch(...)`
- Responsibility:
  - Define the neutral palette
  - Define accent palettes
  - Define status palettes

Rules:

- Primitive tokens must not reference semantic tokens
- Primitive tokens must not encode component meaning
- New primitive colors should be added only when reuse is expected

### 2. Semantic tokens

Semantic tokens define app-level meaning.

- Prefix examples: `--color-bg-*`, `--color-text-*`, `--color-border-*`, `--color-accent-*`, `--color-danger-*`
- Preferred syntax: `var(...)`
- Allowed sources:
  - Primitive tokens
  - Rare explicit `oklch(... / alpha)` values when a semantic layer requires a direct translucent surface

Rules:

- Semantic tokens should express purpose, not implementation
- Components should prefer semantic tokens over primitive tokens
- Theme overrides should preserve semantic token names

### 3. State / derived tokens

State tokens encode hover, active, selected, focus, or other derived interactions.

- Examples:
  - `--color-focus-ring`
  - `--color-selection-bg`
  - `--color-accent-border`
  - `--color-surface-selected`
- Allowed syntax:
  - `color-mix(in oklch, ...)`
  - `var(...)`
  - `oklch(... / alpha)` for deliberate translucent states

Rules:

- Derived tokens should reference semantic tokens first
- Reusable interaction colors must live in `colors.css`, not inline in component files
- `color-mix(in srgb, ...)` is not allowed for new shared tokens

### 4. Component exceptions

Some visuals require tighter tuning than generic token rules can provide.

- Examples:
  - editor active line
  - editor selection match
  - other readability-sensitive overlays

Rules:

- Exceptions must be isolated in the component exception section
- Exceptions should include a short comment if they exist for readability or contrast reasons
- Exceptions should not become a backdoor for general-purpose token authoring

## Allowed Syntax Summary

- Preferred:
  - `oklch(...)`
  - `oklch(... / alpha)`
  - `var(...)`
  - `color-mix(in oklch, ...)`
- Avoid for new work:
  - `hex`
  - `rgb()`
  - `color-mix(in srgb, ...)`

## Dependency Direction

Token dependencies must flow in one direction only:

1. Primitive
2. Semantic
3. State / derived
4. Component exception

Lower layers must not depend on higher layers.

## Theme Rules

- Keep a single shared semantic token API across themes
- Override semantic and state tokens in `:root[data-theme="dark"]`
- Do not let component styles branch on theme-specific primitive values

## Consumption Rules

- Component styles should consume semantic or state tokens
- Direct primitive token usage in component files should be rare
- Reusable `color-mix(...)` expressions belong in `colors.css`

## Naming Rules

- Primitive: `--{palette}-{step}`
- Semantic: `--color-{role}-{slot}`
- State: `--color-{role}-{state}`
- Component exception: `--color-{component}-{slot}`

Examples:

- `--slate-200`
- `--color-bg-panel`
- `--color-selection-bg-strong`
- `--color-editor-active-line`

## Review Checklist

- Is this token in the correct layer?
- Is a raw color being introduced outside the primitive layer without justification?
- Is a reusable derived color being computed inline in a component file?
- Does the dark theme preserve the same semantic API?
- If this is an exception, is the reason explicit?
