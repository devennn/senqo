---
name: Luminous Clarity
colors:
  surface: "#f9f9ff"
  surface-dim: "#d3daea"
  surface-bright: "#f9f9ff"
  surface-container-lowest: "#ffffff"
  surface-container-low: "#f0f3ff"
  surface-container: "#e7eefe"
  surface-container-high: "#e2e8f8"
  surface-container-highest: "#dce2f3"
  on-surface: "#151c27"
  on-surface-variant: "#3c4a42"
  inverse-surface: "#2a313d"
  inverse-on-surface: "#ebf1ff"
  outline: "#6c7a71"
  outline-variant: "#bbcabf"
  surface-tint: "#006c49"
  primary: "#006c49"
  on-primary: "#ffffff"
  primary-container: "#10b981"
  on-primary-container: "#00422b"
  inverse-primary: "#4edea3"
  secondary: "#52625c"
  on-secondary: "#ffffff"
  secondary-container: "#d3e3dc"
  on-secondary-container: "#566660"
  tertiary: "#2b6954"
  on-tertiary: "#ffffff"
  tertiary-container: "#71af97"
  on-tertiary-container: "#004231"
  error: "#ba1a1a"
  on-error: "#ffffff"
  error-container: "#ffdad6"
  on-error-container: "#93000a"
  primary-fixed: "#6ffbbe"
  primary-fixed-dim: "#4edea3"
  on-primary-fixed: "#002113"
  on-primary-fixed-variant: "#005236"
  secondary-fixed: "#d5e6df"
  secondary-fixed-dim: "#bacac3"
  on-secondary-fixed: "#101e1a"
  on-secondary-fixed-variant: "#3b4a44"
  tertiary-fixed: "#b0f0d6"
  tertiary-fixed-dim: "#95d3ba"
  on-tertiary-fixed: "#002117"
  on-tertiary-fixed-variant: "#0b513d"
  background: "#f9f9ff"
  on-background: "#151c27"
  surface-variant: "#dce2f3"
typography:
  headline-xl:
    fontFamily: Lexend
    fontSize: 48px
    fontWeight: "600"
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Lexend
    fontSize: 32px
    fontWeight: "600"
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Lexend
    fontSize: 28px
    fontWeight: "600"
    lineHeight: 36px
  headline-md:
    fontFamily: Lexend
    fontSize: 24px
    fontWeight: "500"
    lineHeight: 32px
  body-lg:
    fontFamily: Lexend
    fontSize: 18px
    fontWeight: "400"
    lineHeight: 28px
  body-md:
    fontFamily: Lexend
    fontSize: 16px
    fontWeight: "400"
    lineHeight: 24px
  label-md:
    fontFamily: Lexend
    fontSize: 14px
    fontWeight: "500"
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Lexend
    fontSize: 12px
    fontWeight: "600"
    lineHeight: 16px
    letterSpacing: 0.03em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 20px
  margin-desktop: 40px
  section-gap: 80px
---

## Brand & Style

The design system is defined by an approachable, premium aesthetic that balances playfulness with functional clarity. It targets a modern audience that values ease of use and emotional resonance.

The style is **Refined Minimalism** with a hint of **Soft Modernism**. It leverages generous whitespace to reduce cognitive load and creates a "light-as-air" feel. The emotional response is intended to be optimistic, trustworthy, and effortless. Visual interest is generated through precise typography and subtle depth rather than heavy ornamentation.

## Colors

The palette centers on a vibrant, health-conscious green.

- **Primary:** The core brand green (#10B981), used for primary actions and brand presence.
- **Secondary:** A soft mint tint (#ECFDF5) used for large surface areas, subtle highlights, and background layering to maintain a "fresh" atmosphere.
- **Tertiary:** A deep forest green (#064E3B) reserved for high-contrast text or grounding elements.
- **Neutral:** A balanced slate-gray scale used for body text and borders to ensure the green remains the focal point.

### Dark theme

Dark mode is a first-class surface, not an inverted light theme. Tokens live under `.dark` in `frontend/src/globals.css`. Rules:

- **Surfaces stay dark end-to-end.** Page shell, chat thread, cards, and panels must use dark tokens — never hardcode light fills (`#ffffff`, `#f9f9ff`, `#ecfdf5`, WhatsApp mint `#d9fdd3`) without a `dark:` counterpart.
- **Primary shifts to mint** (`inverse-primary` / `#4EDEA3`) on dark surfaces so CTAs remain visible; **on-primary** stays near-black (`#002113`) for contrast on that mint.
- **Cards / panels:** solid elevated charcoal (not translucent glass), Level 1 dark shadow, hairline light border at ~12% opacity. Nested rows use a deeper secondary/muted fill — not pale mint.
- **Text:** `foreground` / `on-surface` for primary copy; `muted-foreground` must stay clearly readable on card and list backgrounds (avoid light-theme slate on dark fills).
- **Chat bubbles:** outgoing uses a deep green fill with light text; incoming uses elevated muted/card fill with light text. Do not reuse light-mode bubble colors in dark mode.
- **Destructive:** solid error red with white label in both themes (same as light) — not soft error-container pink.
- **Shell / chat utilities** (`bg-app-shell`, `bg-chat-thread`, `glass`) must resolve through theme tokens so they adapt with `.dark`.

## Typography

This design system utilizes **Lexend** across all levels. Lexend was chosen for its unique intersection of "fun" rounded terminals and "clear" hyper-legibility.

Headlines use medium to semi-bold weights with slight negative letter-spacing to feel tight and professional. Body text is set with generous line heights to enhance the "light" and "airy" feeling of the brand. Labels use slightly heavier weights and increased letter spacing to maintain readability at small scales.

## Layout & Spacing

The layout follows a **Fixed-Fluid Hybrid** model. Content is contained within a 1280px max-width container on desktop, centered with wide margins to emphasize a premium, editorial feel.

Spacing is governed by an 8px linear scale. To achieve the "generous whitespace" requested, standard vertical padding between sections is increased to 80px (section-gap). Gutters are kept wide (24px) to ensure layout elements never feel cramped. On mobile, margins reduce slightly to 20px to maximize real estate while maintaining a "breathable" frame.

## Elevation & Depth

Depth is created through **Tonal Layering**, **Ambient Shadows**, and a **hairline outline** on raised surfaces.

- **Page and content-panel backgrounds** stay on their existing tokens (for example `background`, `bg-card/95` shells) — do **not** change them to fix card contrast. **Cards (light):** solid white (#FFFFFF), Level 1 shadow, and outline-variant border so they read clearly on any light surface. **Cards (dark):** solid elevated charcoal (`--card`), Level 1 dark shadow, and a light hairline border — never force white card shells in dark mode.
- **Level 1 (cards, panels, light):** `0 1px 2px rgba(21, 28, 39, 0.06), 0 4px 16px rgba(21, 28, 39, 0.06), 0 8px 24px rgba(16, 185, 129, 0.1)` plus a **1px** `outline-variant` border (#BBCABF). Cards must remain visible without hover; do not rely on shadow alone.
- **Level 1 (dark):** stronger ambient black shadow plus a soft primary glow; border at ~12% light opacity.
- **Level 2 (modals, sheets):** light `0 12px 40px rgba(0, 0, 0, 0.08)`; dark `0 12px 40px rgba(0, 0, 0, 0.35)` (no extra border on the shell).
- **Secondary** green (#ECFDF5) is for inset rows, chips, and nested blocks inside a card in light mode — not for the outer card shell. In dark mode use `--secondary` / `--muted` deep fills instead.

## Shapes

The shape language is **Rounded**, echoing the geometry of the Lexend typeface.

- Standard components (buttons, inputs) use a 0.5rem (8px) radius.
- Larger containers (cards, modals) use a 1rem (16px) radius.
- This creates a soft, friendly silhouette that removes the "aggression" of sharp corners, reinforcing the approachable brand personality.

## Components

- **Buttons:** Primary buttons feature a solid Primary Green fill with white text (light) or mint fill with near-black text (dark). Hover states should transition to a slightly darker/richer shade. Secondary buttons use a Primary border with the Secondary tint. **Delete** and other destructive confirms use the `destructive` variant: solid error red (`#BA1A1A`) with white label text in both themes — not outline, muted tints, or soft error-container pink.
- **Inputs:** Fields use a 1px border in a light neutral, which transitions to a 2px Primary Green border on focus. Labels sit clearly above the field in a `label-md` style.
- **Cards:** Cards are the primary vessel for information. **Light:** solid white (`#FFFFFF`), **Level 1** shadow, **1px** `outline-variant` border (#BBCABF), **1rem** corner radius. **Dark:** solid `--card` charcoal with the dark Level 1 shadow and light hairline border. Do not use `opacity` / `backdrop-blur` on the card shell. Nested content rows may use **Secondary** (light) or `--muted` / `--secondary` (dark) fill with the same hairline border.
- **Chips:** Highly rounded (pill-shaped) with the Secondary Green background and Primary Green text.
- **Lists:** Items are separated by generous 16px vertical gaps rather than thin lines, using white space as the primary separator.
- **Progress Indicators:** Use soft, rounded caps on all bar elements to match the shape language.
