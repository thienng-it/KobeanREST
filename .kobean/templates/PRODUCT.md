# PRODUCT.md — Design System & Brand Direction

> Maintained by `kb-ui` (`ui-ux-designer` role) following the Impeccable + Taste-Skill doctrine. Read this before building or modifying any frontend surface.

## 1. Product Identity & Audience
- **Kind of Product / Business:** <e.g., B2B developer tool, consumer fintech, local studio>
- **Primary User & Context:** <who uses it, on what viewport, in what state of mind>
- **Voice & Tone:** <plain, direct, zero marketing fluff>
- **Design Mode:** `Default (Impeccable Craft)` | `Bold (Taste-Skill Art Direction)`

## 2. Typography Scale & Pairing
- **Display / Headings:** `<Font Name>`, weights `<...>`, tracking `<...>`
- **Body / UI:** `<Font Name>`, weights `<...>`, line-height `<...>`
- **Monospace / Data:** `<Font Name>`, `tabular-nums` required on all tables/metrics

## 3. Color Tokens (Semantic — Light & Dark)
- **Surface / Ground:** `bg-primary`, `bg-elevated`, `bg-subtle`
- **Ink / Text:** `text-primary` (>= 7:1), `text-secondary` (>= 4.5:1), `text-muted`
- **Accent & Semantic:** `accent-primary`, `status-success`, `status-warning`, `status-danger`

## 4. Layout & Rhythm Rules
- **Container & Edges:** Max-width `<...>`, equal left/right edges at `1440px`, `1024px`, `768px`, `390px`.
- **Spacing Scale:** `<4px / 8px base grid>`
- **Motion Rules:** Subtle `150ms–220ms` ease-out transitions; respect `prefers-reduced-motion`.

## 5. Project-Specific Anti-Patterns (Hard Bans)
- Never use generic blue-purple neon gradients or unstyled 3-icon feature cards.
- Never ship a component without `loading`, `empty`, `error`, and `:focus-visible` states.

