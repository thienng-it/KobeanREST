# Accessibility (WCAG 2.2 AA) Audit Checklist

> Distilled from `addyosmani/web-quality-skills` (`accessibility`), `vercel-labs/agent-skills` (`web-design-guidelines`), and `pbakaus/impeccable` (`audit`).
> **Antigravity Integration:** When running on Antigravity, pair this checklist with the native `a11y-debugging` skill and `chrome-devtools-mcp` (`take_snapshot`).

## 1. Semantic Structure & Landmarks (Perceivable)
- [ ] Every page has exactly one `<h1>` and a logical heading hierarchy (`h1` -> `h2` -> `h3`, no skipped levels).
- [ ] Landmark regions are present and distinct: `<header>`, `<nav>`, `<main>`, `<footer>`, `<aside>`.
- [ ] Interactive elements use native controls: `<button>` for actions, `<a href="...">` for navigation. Never attach `onClick` to a `<div>` or `<span>` without `role`, `tabIndex={0}`, and `onKeyDown` (`Enter`/`Space`).
- [ ] Every form input has a programmatic `<label htmlFor="...">` or `aria-labelledby`. Placeholders are never used as the sole label.

## 2. Keyboard & Focus Management (Operable)
- [ ] Every interactive control is reachable and operable via `Tab`, `Shift+Tab`, `Enter`, `Space`, and arrow keys.
- [ ] **Visible Focus Ring:** `:focus-visible` has a clear, high-contrast outline (`>= 3:1` against adjacent surface). `outline: none` without a `:focus-visible` replacement is a **hard fail**.
- [ ] **Modals / Dialogs / Drawers:** Focus moves inside on open, traps `Tab` while open, closes on `Escape`, and restores focus to the trigger element on close (prefer native `<dialog>`).
- [ ] **Touch & Pointer Targets:** All interactive targets are at least `24x24 CSS px` (`44x44 px` recommended on mobile).

## 3. Contrast, Motion & Visuals
- [ ] Body text contrast `>= 4.5:1`; large text (`>= 18pt` or `14pt bold`) and UI controls `>= 3:1`.
- [ ] Information is never conveyed by color alone (pair red/green status with an icon or text label).
- [ ] Animations and transitions respect `@media (prefers-reduced-motion: reduce)`.
- [ ] Meaningful images have concise `alt` text; decorative images/icons have `alt=""` or `aria-hidden="true"`.

## 4. Dynamic Updates (Robust)
- [ ] Async form errors connect to the input via `aria-describedby` and set `aria-invalid="true"`.
- [ ] Toast notifications and async status banners use `role="status"` (`aria-live="polite"`) or `role="alert"`.

