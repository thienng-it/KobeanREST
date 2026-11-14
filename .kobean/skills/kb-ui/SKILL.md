---
name: kb-ui
description: >-
  High-craft UI/UX design, art direction, and frontend implementation using
  Impeccable (default craft), Taste-Skill (opt-in bold mode), and native
  chrome-devtools-mcp verification. Use whenever designing, building, restyling,
  polishing, or auditing web or mobile user interfaces.
---

# `kb-ui` — Impeccable + Taste-Skill UI/UX Engineering

Distilled from **Impeccable** (`pbakaus/impeccable`), **Taste-Skill** (`Leonxlnx/taste-skill`), **UI-UX-Pro-Max** (reference lookup), **Vercel Web Design Guidelines**, and **Addy Osmani Web Quality Skills**.

## Active Roles Loaded by This Skill
- [`~/.kobean/roles/ui-ux-designer.yaml`](../../roles/ui-ux-designer.yaml) *(art direction, `PRODUCT.md`, tokens)*
- [`~/.kobean/roles/frontend.yaml`](../../roles/frontend.yaml) *(React/Next.js/Tailwind implementation)*
- [`~/.kobean/roles/a11y-auditor.yaml`](../../roles/a11y-auditor.yaml) *(WCAG 2.2 AA verification)*

---

## Procedure

### 1. Activate Antigravity Web Guidance & Read Doctrine
1. **Mandatory on Antigravity:** If building or editing HTML/CSS/DOM, read and apply the installed `modern-web-guidance` skill first so modern CSS/DOM APIs (`<dialog>`, popover, container queries, `:focus-visible`) are used instead of legacy patterns.
2. Read `references/design/impeccable-taste.md` and `references/checklists/wcag.md` (from `.kobean/` or `~/.kobean/`).

### 2. Establish `PRODUCT.md` & Mode (`default` vs. `bold`)
1. Check for `PRODUCT.md` in the project root. If missing, create it from `templates/PRODUCT.md` (from `.kobean/` or `~/.kobean/`).
2. Select the design mode:
   - **`default` (Impeccable Craft):** For product UIs, dashboards, forms, tables, settings, and workflows. Focus on clarity, hierarchy, `tabular-nums`, tinted neutrals, and complete states.
   - **`bold` (Taste-Skill 2.5 Art Direction):** Triggered when the user asks for `bold`, a landing page, marketing site, or portfolio. Enforce:
     - 1-section-per-screen rhythm at `1440x900` (hero alone on first viewport).
     - Equal left and right content edges across all sections.
     - Hero entrance (`data-enter`) + 1–2 dealt visual moments per page.
     - Plain, direct copy; zero captions underneath images/visuals.

### 3. Build with Hard Anti-Slop Bans
While implementing the UI (`frontend` role):
- **Never** use generic neon purple-to-blue gradients, 3-equal-icon marketing cards, or filler AI copy ("Supercharge your workflow").
- Implement all **4 required states** for every data-driven view: `loading` (layout-matched skeleton with `CLS = 0`), `empty`, `error` (with retry), and `populated`.
- Ensure every interactive element has `:focus-visible` styling and full keyboard operability.

### 4. Live Browser & Accessibility Gate (`chrome-devtools-mcp`)
Never declare a UI task finished from static code alone when a dev server can be run:
1. Start or connect to the local dev server and inspect with `chrome-devtools-mcp`:
   - Check responsive layout and equal edges at `1440px`, `1024px`, `768px`, and `390px` (`resize_page` + `take_screenshot`).
   - Inspect the accessibility tree (`take_snapshot`) and console errors (`list_console_messages`).
   - On Antigravity, delegate deep accessibility or LCP issues to the installed `a11y-debugging` and `debug-optimize-lcp` skills.
2. Fix any contrast, alignment, overflow, or keyboard focus defects before returning to the user.

