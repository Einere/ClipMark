# Color System Migration Plan

## Context

`src/styles/colors.css` currently mixes `hex`, `rgb()`, and `color-mix()` without a strict layering rule.
The immediate goal is not a visual redesign. The goal is to make color ownership, derivation, and theme overrides predictable for developers.

## Goals

- Introduce a stable token hierarchy: `primitive -> semantic -> state -> component exception`
- Standardize primitive color definitions on `oklch(...)`
- Standardize derived colors on `color-mix(in oklch, ...)`
- Keep the existing semantic token API stable where possible
- Minimize ad hoc color calculations in component styles
- Preserve existing light and dark theme behavior as closely as practical

## Non-goals

- Rebranding or major palette redesign
- Renaming the full token API in one pass
- Perfectly eliminating all exceptions in editor-specific visuals

## Migration Phases

### Phase 1: Document the rules

- Add a persistent color token specification to `docs/`
- Define allowed token layers, allowed syntax, and exception policy
- Use the document as the source of truth for future changes

### Phase 2: Rebuild `colors.css` around token layers

- Reorganize the file into:
  - Primitive palette
  - Semantic tokens
  - Derived state tokens
  - Component exceptions
- Convert primitive palette values to `oklch(...)`
- Migrate derived tokens to `color-mix(in oklch, ...)`
- Keep semantic token names stable unless there is a strong reason to change them

### Phase 3: Remove component-local color math

- Move ad hoc `color-mix(...)` usage out of component styles where the value is reusable
- Replace component-local calculations with semantic or state tokens from `colors.css`

### Phase 4: Verify and tune exceptions

- Check light and dark theme contrast in the app shell, buttons, overlays, and editor
- Keep editor-specific readability overrides when the generic derivation rule is not sufficient
- Mark those cases explicitly as exceptions in `colors.css`

## Acceptance Criteria

- `src/styles/colors.css` has clear token sections with comments
- Primitive tokens are defined in `oklch(...)`
- Shared derived tokens use `color-mix(in oklch, ...)`
- `src/styles/components.css` no longer contains reusable ad hoc color derivations
- Theme overrides happen through the same semantic token API
- Exception cases are isolated and documented

## Follow-up Work

- Audit other style files for direct primitive use
- Consider moving more component-specific state tokens into semantic/state layers
- Add visual regression checks if the project later adopts screenshot-based verification
