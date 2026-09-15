---
type: design-system
version: 1
updated: 2026-09-15
tokens:
  color.bg.light: "#FBFAF7"
  color.surface.light: "#FFFFFF"
  color.surface-muted.light: "#F4F1EA"
  color.ink.light: "#1C1917"
  color.ink-2.light: "#57534E"
  color.ink-3.light: "#7C7468"
  color.line.light: "#E7E2D8"
  color.bg.dark: "#121110"
  color.surface.dark: "#1B1917"
  color.surface-muted.dark: "#24211E"
  color.ink.dark: "#F5F1EA"
  color.ink-2.dark: "#A8A29E"
  color.ink-3.dark: "#8B8580"
  color.line.dark: "#332F2A"
  color.accent: "#F7931A"
  color.accent-ink.light: "#B45309"
  color.accent-ink.dark: "#FBBF24"
  color.ok.light: "#15803D"
  color.warn.light: "#B45309"
  color.err.light: "#B91C1C"
  color.info.light: "#2563EB"
  color.ok.dark: "#4ADE80"
  color.warn.dark: "#FBBF24"
  color.err.dark: "#F87171"
  color.info.dark: "#60A5FA"
  type.ui.family: "Inter"
  type.ui.fallback: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  type.ui.weight.regular: "400"
  type.ui.weight.medium: "500"
  type.ui.weight.semibold: "600"
  type.display.family: "'Newsreader', Georgia, 'Times New Roman', serif"
  type.data.family: "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace"
  type.scale.12: "0.75rem"
  type.scale.13: "0.8125rem"
  type.scale.14: "0.875rem"
  type.scale.16: "1rem"
  type.scale.20: "1.25rem"
  type.scale.24: "1.5rem"
  type.scale.32: "2rem"
  type.scale.44: "2.75rem"
  type.scale.60: "3.75rem"
  type.measure: "68ch"
  spacing.1: "4px"
  spacing.2: "8px"
  spacing.3: "12px"
  spacing.4: "16px"
  spacing.5: "20px"
  spacing.6: "24px"
  spacing.8: "32px"
  spacing.12: "48px"
  spacing.16: "64px"
  spacing.24: "96px"
  layout.container: "1200px"
  layout.gutter: "clamp(20px, 4vw, 32px)"
  layout.radius.input: "6px"
  layout.radius.card: "10px"
  layout.radius.panel: "14px"
  grid.columns: "12"
  grid.breakpoints: "480 / 768 / 1024 / 1280"
  motion.duration.fast: "120ms"
  motion.duration.base: "180ms"
  motion.ease: "cubic-bezier(0.2, 0.8, 0.2, 1)"
  component.target: "44px"
  a11y.focus-ring: "2px solid var(--accent), 3px spotlight offset 8px"
---

# BSAHI — Design System

BitcoinSahi is a Bitcoin **stress and boundary observatory**. It measures what
Bitcoin costs to operate, verify, secure, and coordinate — and studies when those
costs push the system toward a measurable boundary. Its metric #1 is SCCR, the
Storage Cost Coverage Ratio.

**Single question:** "How much stress can Bitcoin absorb before the cost of
participating, verifying, producing, or coordinating becomes meaningfully
asymmetric?"

## Memorable thing

One impression to land in the first five seconds:

> **"Serious Bitcoin research that measures something real you can't see — data you
> can trust at a glance."**

Every design decision serves these three tensions: credibility (institutions-grade,
never crypto hype), measurability (the invisible → visible), and trustworthiness
(freshness and confidence legible at a glance).

## Design principles

1. **Evidence first.** Every number carries a source and a timestamp. Data never
   appears naked; decoration never pretends to be data.
2. **Signal over noise.** One message per view. If a chart adds no information,
   it belongs in the appendix, not the page.
3. **Honesty as UI.** Data state is a first-class visual state: fresh / stale /
   empty / loading / error are each a labeled, styled state. A stale number is
   never a broken look — it is an explicit warning with its age.
4. **Progressive disclosure.** Define the measurement in one line, then deepen:
   metric → how it's measured → methodology → reproduce. Never a wall up front.
5. **Bitcoin-native restraint.** One accent, bitcoin orange. Everything else is
   ink and paper. Orange is reserved for authority data and the brand — not for
   decoration.
6. **Mobile-first, desktop-complete.** The reading experience is designed for a
   phone; the density for a desktop. Both are first-class, neither is a fallback.

## Aesthetic

Light-first editorial research platform. Warm bone "paper" (#FBFAF7) with near-black
warm ink (#1C1917), hairline rules instead of heavy borders, editorial serif
(Newsreader) for theses and display headlines, a clean grotesque (Inter) for UI and
body, and IBM Plex Mono for every number that is a fact. The live dashboard reads
like a Bloomberg-grade terminal in dark mode; the papers and research read like The
Economist in light mode. Dark mode is auto-derived from the same tokens, triggered
by `prefers-color-scheme` — never a separate theme.

## Typography

Three families, each with one job:

- **Display (serif): Newsreader.** Theses, metric names, and editorial headlines.
  Voice: a research report, not a landing page. Weights 400/500; italic for
  emphasis when quoting methodology.
- **UI (sans): Inter.** Interface, body copy, navigation. Weights 400/500/600.
  Body measure ≤ 68ch.
- **Data (mono): IBM Plex Mono.** Every number that is a fact: fees, prices,
  heights, SCCR values, table figures. Mono makes facts distinct from prose.

**Scale** (fluid, major third 1.25):

| Token | rem | Use |
| --- | --- | --- |
| 12 | 0.75 | Data labels, meta, footnotes |
| 13 | 0.8125 | Small UI, table headers |
| 14 | 0.875 | Body small, table cells, captions |
| 16 | 1.0 | Base body, inputs, buttons |
| 20 | 1.25 | Subsection, card titles |
| 24 | 1.5 | Section heading |
| 32 | 2.0 | Page heading |
| 44 | 2.75 | Hero / thesis (clamp 32–44) |
| 60 | 3.75 | Display only (clamped out on mobile) |

Headings: serif display tight leading (1.05–1.15), UI body leading 1.5. No
all-caps runs longer than two words. Numeric facts always in mono.

## Color

Light (paper) and dark (obsidian) are the same system — tokens switch by
`prefers-color-scheme`; the accent is theme-independent.

Semantic roles:

- `bg` page background; `surface` raised cards; `surface-muted` wells/skeleton.
- `ink` primary text; `ink-2` secondary; `ink-3` hints/meta (never body text).
- `line` hairline rules; dividers; table row borders.
- `accent` bitcoin orange: brand, primary CTA, the SCCR figure, focus ring.
- `accent-ink` orange text on paper (light) / amber on obsidian (dark) — the
  readable form of the accent when orange paint would fail contrast.
- `ok`/`warn`/`err`/`info`: semantic status only (fresh/stale/error/info).
  Never decorative.

Contrast (all pass WCAG AA 4.5:1 on their background, verified at build):

| Pair | Ratio (light) | Ratio (dark) |
| --- | --- | --- |
| ink on bg | 14.9:1 | 15.3:1 |
| ink-2 on bg | 7.2:1 | 7.6:1 |
| ink-3 on surface | 4.7:1 | 4.6:1 |
| accent-ink on bg | 5.4:1 | 6.1:1 |
| accent (paint) on bg | 2.7:1 — **icon/decoration only** | 2.9:1 — **icon only** |

Rule: orange paint is for fills, underlines, and focus rings. Whenever orange is
the carrier of text, use `accent-ink`. A value written in `#F7931A` on paper is a
violation.

## Spacing and grid

4px base scale. Density is conservative: 16/20 on cards, 24 on section rhythm,
48 on page sections, 96 on theses. Mobile gutter `20–32px` fluid via `layout.gutter`.

12-column grid, container 1200px. Breakpoints are mobile-first: `480 / 768 /
1024 / 1280`. Column spans: stat grids collapse to 1-col on ≤480, 2-col ≤768,
3–4-col ≥1024.

## Components

**Buttons** — 3 variants (`primary` orange, `secondary` ink outline, `ghost`),
3 sizes (sm/md/lg ≥44px touch), states: hover (accent → one step darker or
underline), active (translateY 1px), focus-visible (2px accent ring, offset 8px),
disabled (ink-3, `not-allowed`, reduced opacity). Never a full-bleed orange wall;
primary buttons carry the one action per view.

**Forms** — labels always visible (never placeholder-as-label), mono value inputs
for numeric fields, 4px radius, 1px `line` border → 2px ink on focus. States:
help text (ink-2), error (err text + 1px err border + aria-describedby), disabled
(ink-3). Required marked, never asterisk-only.

**Cards** — three card types:
- *Stat card*: `label (13, ink-2)` / `value (24, mono, ink)` / `delta (12, ok|err
  with ↓↑ glyphs)` / `freshness tag (12)` / optional sparkline. The freshness tag
  is mandatory on every live stat — trust at a glance.
- *Definition card*: term (serif 20) + plain-language definition per principle 4.
- *Research card*: `eyebrow (12, accent)` / `title (serif 24)` / `excerpt (14,
  ink-2)` / `meta (12): date · reading time · tag`. Hover: hairline → full accent
  left rule.

**Tables** — research-grade: hairline `line` rows (no zebra in light, optional
weave in dark at surface-muted), mono for all numeric cells, right-aligned
numbers, sticky header on scroll, `13` header row with sortable affordance, empty
state = explicit row ("No samples yet") not a blank grid, error state = inline
message + retry. Footnotes under the table, not floating.

**Charts** — Canvas/JS renderers share chart tokens: axis line = `line`, grid =
`line` at 50% opacity, labels = `ink-2` mono, series colors limited to the token
set only (`accent`, `ok`, `err`, `info`), warnings/annotations = `warn`. Rules: a
chart without labeled axes, a source, and a freshness stamp is not shipped. No
3D, no gradients, no dual-axis deception, no chart element that is decorative.

**Navigation** — top bar: brand wordmark (serif "BitcoinSahi", orange plural on
"₿") · primary links (Dashboard · Live · Research · Learn) · a **data-status chip**
(fresh/stale with age) always visible on the right · theme follows OS (no toggle
in v1). Mobile: bottom-sheet drawer, ≥44px targets, current page = accent underline
2px. No hamburger-only nav: the two most used destinations stay visible.

**Tags & badges** — semantic: `fresh` (ok), `stale` (warn), `error` (err), plus
content tags (LOW/MODERATE/HIGH fees → ok/warn/err borders). Round 999px, mono
12px, 1px border, never filled orange for a content tag.

**States** — loading = skeleton (surface-muted shimmer, no spinners for data);
empty = icon + one line + optional action; error = message + cause + retry;
stale = amber banner with the age ("Data stale — 4h old, retrying").
`aria-live="polite"` announces live updates.

## Icons

Inline SVG, stroke-based, 1.5px stroke, 16/20/24 sizes. The single glyph set:
arrows (↑↓→), freshness (✓ / ⚠ / ✕), network (nodes, mempool), document, external,
search. **No emoji in UI.** Emoji currently in the codebase is a debt — the icon
system replaces it page by page.

## Responsive behavior

- ≤480: single column, stat cards stack, tables become horizontal-scroll (mono
  numerics keep alignment), thesis hero clamps to 32.
- 481–768: 2-col stat grids, drawer nav glyph-first.
- 769–1024: 3–4 col, container 100%−gutter.
- ≥1025: 1200px container, table densities at full width.
Charts re-render on resize (canvas), never letterbox.

## Accessibility

- WCAG 2.1 AA target; the contrast table above is the gate.
- Focus-visible ring on every interactive element (2px accent, 3px offset).
- One `h1` per page; landmarks (header/nav/main/footer) on every page.
- Touch targets ≥44px (`component.target`).
- `prefers-reduced-motion`: animations collapse to opacity-only; skeleton shimmer
  freezes; no autoplay.
- Tables carry `th scope`, captions, and `aria-sort` when sortable.
- Live regions announce fee/stat updates; stale is announced as a status change.
- The site is usable without JS: static HTML carries the text and the current
  SCCR values (the bake pipeline), JS only hydrates live numbers.

## Data provenance in UI

Every data-region pattern: **value · source · timestamp**. The freshness chip
describes the binding field (`payload_ts`). A snapshot older than 24h renders the
stale banner and grays non-critical charts. This is the "trust at a glance"
contract — implemented as the `DataHealth` component once, used everywhere.

## Reset scope

This system replaces the hand-painted collection: per-page `style` blocks, inline
`style=` attributes, the candle-lit gold palette, ad-hoc stat colors, and emoji
icons. Migration order: tokens → shared `style.css` → homepage → live dashboard →
learn/status → research pages → tables/footnotes pass.