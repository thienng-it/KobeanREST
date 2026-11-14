# UI/UX Craft Doctrine: Impeccable + Taste-Skill + Pro-Max Lookup

> Distilled from `pbakaus/impeccable` (Apache-2.0), `Leonxlnx/taste-skill` (MIT), and `nextlevelbuilder/ui-ux-pro-max-skill` (MIT).
> **Antigravity Integration:** Always execute the installed `modern-web-guidance` skill first on HTML/CSS/DOM tasks, and use `chrome-devtools-mcp` (`take_screenshot`, `take_snapshot`, `resize_page`) to visually verify rendered pages across breakpoints.

---

## 1. Mode Selection

| Mode | When to Use | Governing Rules |
| :--- | :--- | :--- |
| **`default` (Impeccable Craft)** | Dashboards, authenticated product UI, forms, tables, settings, internal tools, components | Section 2 + Section 4 |
| **`bold` (Taste-Skill Art Direction)** | Landing pages, company/product marketing sites, portfolios, or when the user asks for `bold`, `delight`, or high-craft brand pages | Section 2 + Section 3 + Section 4 |

---

## 2. Core Impeccable Doctrine (Always Active)

1. **`PRODUCT.md` First:**
   Read `PRODUCT.md` in the project root before designing or coding UI. If missing, draft it from `.kobean/templates/PRODUCT.md` (or `~/.kobean/templates/PRODUCT.md`) defining: kind of business, target audience, voice, font pairing, semantic color tokens, and spacing grid.
2. **Typographic Hierarchy (`typeset`):**
   - Establish a clear 4-step scale: Display/Hero, Section Title (`h2`), Card/Group Heading (`h3`), Body (`15px–16px`, `1.5–1.6` line-height), and Caption/Meta (`12px–13px`).
   - Enforce `font-variant-numeric: tabular-nums` on every number column, price, timer, or metric card.
   - Constrain reading measure to `60ch–72ch` for prose.
3. **Color & Surface Discipline (`colorize` / `quieter`):**
   - Prefer tinted neutrals (warm stone, cool slate, deep ink) over pure `#000000` or `#ffffff`.
   - Use 1 primary accent color for primary actions; reserve semantic red/amber/emerald strictly for status.
   - Borders should be subtle (`1px solid` at `8%–14%` opacity) rather than heavy drop shadows.
4. **Complete Interactive States (`harden` / `polish`):**
   - Every view and async component must implement: **Skeleton/Loading**, **Empty State** (with a helpful action), **Error State** (with retry), and **Populated State** (tested with both short and overflowing text).
   - Every button/link/input must have distinct `default`, `:hover`, `:active`, `:focus-visible`, and `:disabled` states.

---

## 3. `bold` Mode Rules (Taste-Skill 2.5 Art Direction)

When `bold` mode is active, enforce these rules in addition to Section 2:
1. **Business-Led Direction:** The industry dictates the aesthetic—developer tools, AI, fintech, and gaming use precision grids, live product UI, or technical diagrams; hospitality, retail, and studios use warm editorial typography and real photography.
2. **One Section Per Screen Rhythm:** At `1440x900`, the hero occupies the first screen alone; subsequent sections are sized deliberately (`1` or `2` screens tall) so headings don't awkwardly peek in at the bottom edge.
3. **Equal Left & Right Content Edges:** Every section aligns to the same outer container grid at `1440px`, `1024px`, `768px`, and `390px`.
4. **Dealt Moments & Micro-Interactions:**
   - Hero enters cleanly on load (`data-enter`).
   - Include 1–2 high-craft focal moments per page (an interactive product preview, live architecture diagram, or typographic showcase).
   - Hover micro-interactions: linked cards lift `2px`, framed photos scale `1.02` inside `overflow: hidden`, no 3D tilt gimmicks or auto-advancing carousels.
5. **Plain Copy, Zero Captions Under Visuals:** Write direct copy that states plainly what the product does. Never place descriptive captions underneath images or renders (put license credits in a single footer line).

---

## 4. Hard Anti-Slop Bans (Never Ship)

- **Banned Palettes:** Neon purple-to-blue gradients on dark navy cards (`#6366f1` -> `#a855f7` default AI palette).
- **Banned Layouts:** Three identical rounded cards in a row, each with a lucide icon in a tinted circle and two lines of generic marketing copy ("Lightning Fast", "Bank-Grade Security", "Seamless Integration").
- **Banned Copy:** "Supercharge your workflow", "Unleash the power of AI", "Next-generation platform", fake testimonials, or fake metrics (`99.99%`, `10x faster`) not backed by product context.
- **Banned Markup:** Broken image URLs, empty placeholder boxes, horizontal overflow at `390px` mobile width, or missing `:focus-visible`.

---

## 5. Industry Palette & Typography Lookup (`ui-ux-pro-max` Reference)

Use these curated pairings only when initializing `PRODUCT.md` and the user has not specified brand assets:

| Domain | Recommended Font Pairing (Heading / Body / Mono) | Surface & Accent Direction |
| :--- | :--- | :--- |
| **Developer Tools / Infra / AI** | `Geist` or `Space Grotesk` / `Inter` / `JetBrains Mono` | Deep carbon (`#0B0D10`), crisp slate borders (`#1E232B`), high-contrast signal accent (amber `#F59E0B` or electric cyan `#06B6D4`). |
| **B2B SaaS / Productivity** | `Plus Jakarta Sans` or `Instrument Sans` / `Inter` / `Geist Mono` | Warm alabaster (`#FAF9F6`), ink text (`#111315`), deep forest (`#0F5338`) or cobalt (`#1D4ED8`) primary action. |
| **Fintech / Analytics** | `Söhne` or `General Sans` / `Plus Jakarta Sans` / `IBM Plex Mono` | High-trust paper/slate surface, strict tabular numbers, restrained navy/emerald palette. |
| **Editorial / Studio / Commerce** | `Instrument Serif` or `Fraunces` / `DM Sans` / `Space Mono` | Warm cream (`#F6F3EC`), charcoal ink (`#1C1917`), terracotta (`#C2410C`) or espresso accents. |

