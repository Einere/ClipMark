# Design System Document

## 1. Overview & Creative North Star

### Creative North Star: "The Digital Atheneum"
This design system is a high-end, editorial-first framework designed specifically for the focused writer. It moves beyond the clinical utility of standard Markdown editors into a realm of sophisticated digital craftsmanship. By marrying the structural clarity of macOS with a "Digital Atheneum" philosophy, we prioritize a layout that feels curated, serene, and authoritative.

The system breaks the "standard template" look by utilizing intentional asymmetry—placing significant visual weight on content while allowing auxiliary navigation to breathe in the periphery. We reject rigid grids in favor of tonal layering, where depth is communicated through the interplay of light and surface rather than harsh lines. The result is a premium workspace that feels like an intentional environment for thought.

---

## 2. Colors

The color palette is rooted in a sophisticated range of cool grays and deep blues, designed to reduce eye strain while providing a canvas for high-contrast accents.

- **Primary & Actions:** Use `primary` (#004fa8) for high-impact actions. For primary CTAs, apply a subtle gradient transitioning from `primary` to `primary_container` (#0366d6) at a 135-degree angle to add "soul" and dimension.
- **Surface & Background:** The foundation is `background` (#f8f9fb). 

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to section off UI components or layouts. Boundaries must be defined solely through background color shifts. For example, a sidebar should be defined by being `surface_container_low` (#f2f4f6) against the main `surface` (#f8f9fb) editor area.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers, like stacked sheets of fine paper.
- **Level 0 (Base):** `surface`
- **Level 1 (Sections):** `surface_container`
- **Level 2 (Active Cards/Modals):** `surface_container_lowest` (#ffffff) to create a "lifted" appearance.

### The "Glass & Gradient" Rule
To achieve a signature macOS feel, use **Glassmorphism** for floating elements (like hover tooltips or floating formatting bars). Use `surface` with 70% opacity and a `backdrop-blur` of 20px. This allows the underlying content to bleed through, softening the interface.

---

## 3. Typography

The typography strategy leverages the clarity of `-apple-system` (San Francisco) to maintain a native feel, while using scale and weight to establish an editorial hierarchy.

- **Display & Headlines:** Use `display-lg` to `headline-sm`. These should feel authoritative. Use tighter letter-spacing (-0.02em) for large headlines to create a bespoke, high-end look.
- **Body Text:** Use `body-lg` (1rem) for the primary editor experience. Readability is paramount; ensure a line height of 1.6 for long-form writing to prevent visual fatigue.
- **Monospace:** Use `ui-monospace` exclusively for code blocks and Markdown syntax. It should be 8% smaller than the surrounding body text to maintain visual optical balance.

**Identity through Scale:** The contrast between a `display-lg` headline and a `label-sm` metadata tag creates a "curated" feel, moving the app away from a generic utility and toward a professional publishing tool.

---

## 4. Elevation & Depth

We eschew traditional structural lines for **Tonal Layering**.

- **The Layering Principle:** Depth is achieved by "stacking" surface tiers. To make a card pop, place a `surface_container_lowest` (#ffffff) card on a `surface_container_low` (#f2f4f6) background. This creates a soft, natural lift.
- **Ambient Shadows:** When a "floating" effect is required (e.g., a modal), use an extra-diffused shadow: `box-shadow: 0 12px 40px rgba(25, 28, 30, 0.06)`. The shadow must be low-opacity and tinted with the `on_surface` color for a natural, ambient light effect.
- **The "Ghost Border" Fallback:** If a boundary is strictly required for accessibility, use a "Ghost Border": the `outline_variant` token at 15% opacity. Never use 100% opaque borders.
- **Vibrancy:** Incorporate macOS "vibrancy" by using semi-transparent surface colors over background content. This integrates the layout into the user’s desktop environment.

---

## 5. Components

### Buttons
- **Primary:** Gradient-filled (`primary` to `primary_container`), `rounded-md` (0.75rem), with `on_primary` text.
- **Secondary:** `surface_container_high` background with `on_surface` text. No border.
- **Tertiary:** Ghost style. Only `primary` colored text, no background until `:hover`.

### Cards & Lists
**Strict Rule:** Forbid divider lines.
- Separate list items using vertical white space (`spacing-4`).
- Use `surface_container_low` for the list container and `surface_container_lowest` for an active/selected item to denote state.

### Input Fields
- **Markdown Editor:** No background or border. The editor is an infinite canvas of `surface`.
- **Search/Form Inputs:** Use `surface_container_high` with a `rounded-sm` (0.25rem) corner. The focus state should be a subtle 2px glow of `surface_tint` at 20% opacity.

### Chips
- Use for tags or metadata. Background: `secondary_container`. Shape: `rounded-full`. Typography: `label-md`.

---

## 6. Do's and Don'ts

### Do
- **DO** use the Spacing Scale religiously. Consistent gaps (e.g., `spacing-8` between major sections) create a sense of professional rhythm.
- **DO** leverage asymmetry. A wide editor area balanced by a narrow, low-contrast sidebar creates a "focused" aesthetic.
- **DO** prioritize "Vibrancy." Allow the user's wallpaper or background elements to subtly influence the UI via translucency.

### Don't
- **DON'T** use black (#000000) for text. Use `on_surface` (#191c1e) to maintain a premium, softer contrast.
- **DON'T** use 90-degree corners. Everything must adhere to the **Roundedness Scale** (default `0.75rem`) to mirror macOS hardware and software language.
- **DON'T** use standard drop shadows. If it looks like a "box shadow" from 2010, it’s too heavy. It should look like light falling on paper.