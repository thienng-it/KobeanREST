# KobeanREST Postman-Style Scripts Design

**Date:** 2026-07-14
**Status:** Approved with no-scroll refinement
**Supersedes:** `2026-07-14-kobeanrest-scripts-ui-refinement-design.md`

## Objective

Replace the visually heavy Scripts tab with a flat, editor-first workspace inspired by Postman's interaction model. The main task—writing pre-request or post-response scripts—must remain obvious, fast, and uncluttered while all existing capabilities stay accessible.

## Design Principles

- One primary editor surface
- No Scripts panel-level vertical scrollbar
- Thin separators instead of nested cards
- Neutral surfaces instead of glass effects, gradients, and large shadows
- Secondary tools appear on demand rather than occupying the document flow
- Compact controls with clear labels and predictable placement
- Equivalent usability in light and dark themes

## Workspace Structure

The Scripts tab contains four layers in this order:

1. A script-type header
2. A compact editor toolbar
3. The code editor
4. A console drawer attached to the editor bottom

The tab and inner workspace fill the available request-pane height without a vertical scrollbar. The editor consumes the remaining height after the fixed header, toolbar, and collapsed console header. Only CodeMirror content and the expanded console body may scroll internally.

## Script-Type Header

Pre-request and Post-request use flat text tabs with an active underline. The control has no pill container, raised active card, gradient, or shadow.

Save Scripts remains aligned to the right as a compact secondary button. It keeps its existing handler, text label, icon, and accessible name. Save must not visually compete with the request-level Send action.

## Editor Toolbar

Use one 40-pixel toolbar separated from the editor by a one-pixel border. It contains:

- Script language selector
- Prettify action
- Snippet selector
- Insert snippet action
- Insert helper menu
- Code action

Controls use 32-pixel heights, 6- to 8-pixel radii, neutral backgrounds, and minimal hover/focus states. Labels use normal sentence case rather than uppercase tracking.

The Insert helper menu replaces the visible row of runtime and environment-variable pills. It lists the same runtime helpers and current variable tokens and inserts the selected item through the existing editor insertion path. This preserves capability while removing a persistent row of visual noise.

The desktop toolbar remains one row. Flexible selectors shrink before actions, labels may hide at constrained widths, and controls use bounded widths so Code and Insert never force a second row. At genuinely narrow mobile widths, the toolbar may wrap rather than create horizontal page overflow.

## Editor

The CodeMirror editor fills the remaining Scripts workspace height. It uses a thin border, a neutral background, a restrained active-line tint, and a visible focus-within border. It has no floating card shadow or oversized radius.

The editor and console drawer form one bounded editor shell. The editor remains the flexible region; the console header stays attached to its bottom. The Scripts request tab panel uses `overflow: hidden`, and every flex ancestor in the chain uses `min-height: 0`, preventing content minimums from creating a nested vertical scrollbar.

Existing editor values, placeholders, variable completion, snippet insertion, formatting, and ready callbacks remain unchanged.

## Request Code

Generated request code leaves the main document flow. A compact Code button in the editor toolbar opens a focused modal.

The modal contains:

- A clear `Request code` title
- Target selector for cURL, Fetch, and Node
- Generated code preview
- Insert into script action
- Close action

Opening or closing the modal only changes local presentation state. Generated content and insertion behavior remain unchanged. The modal uses the existing application modal pattern and keyboard-accessible dialog semantics.

## Console Drawer

Script output becomes a console drawer attached to the editor bottom. It is collapsed by default and its header displays `Console` and the current entry count. It expands upward within the editor shell to a bounded height and never increases the workspace's total height or pushes unrelated request controls below the response dock.

The drawer retains empty, informational, and error states. Expanding or collapsing it does not clear output. The toggle is a native button with `aria-expanded` and `aria-controls`.

## Visual System

- Flat or near-flat white/dark surfaces
- One-pixel neutral borders
- Six- to eight-pixel radii
- No backdrop blur in the Scripts workspace
- No ambient gradients in the Scripts workspace
- No large elevation shadows
- Blue used only for active underline, focus, and primary interactive emphasis
- Transitions limited to 120 milliseconds and removed under reduced-motion preferences

## Responsive Behavior

- The header keeps script tabs and Save Scripts readable.
- The desktop toolbar stays on one row without horizontal overflow.
- The editor retains a practical minimum height.
- The console drawer remains attached to the editor.
- The Code modal fits within the viewport and scrolls internally when required.
- The response dock never overlaps Scripts content.
- The Scripts request panel never displays its own vertical scrollbar.

## Accessibility

- Pre-request and Post-request preserve tab roles and `aria-selected`.
- All toolbar controls retain explicit accessible names.
- The Insert helper menu is keyboard-operable.
- The Code modal uses `role="dialog"`, `aria-modal="true"`, a clear accessible label, and a native close button.
- The console toggle uses `aria-expanded` and `aria-controls`.
- Focus-visible states remain clear in both themes.
- Selected and error states do not rely on color alone.

## Data Flow and Error Handling

Existing script data and handlers remain authoritative:

1. Script tabs select the active pre-request or post-request value.
2. Formatting, snippet insertion, and helper insertion update that value through existing handlers.
3. Save Scripts persists both values through the existing save path.
4. Request code continues to derive from the active draft request.
5. Execution output continues to receive existing informational and error entries.

Presentation state for the Code modal, helper menu, and Console drawer never modifies or clears script data. Existing formatting and execution errors keep their current messages and tones.

## Verification

- Add source contracts for the flat header, single toolbar, helper menu, Code modal, and attached Console drawer.
- Add layout contracts that forbid Scripts workspace backdrop blur, gradients, large shadows, visible helper-chip rows, and inline request-code cards.
- Add contracts requiring `overflow: hidden` on the Scripts request panel and a zero-minimum flex sizing chain through the workspace and editor frame.
- Add a contract that keeps the desktop toolbar on one line.
- Run the full Node test suite.
- Run the TypeScript and Vite production build.
- Inspect the live Scripts tab at normal, narrow, and short window sizes in light and dark themes.
- Verify keyboard access for script tabs, toolbar controls, helper insertion, Code modal, and Console drawer.

## Non-goals

- Reproducing Postman's brand, colors, or proprietary assets
- Changing script execution or persistence
- Adding script languages, snippets, or request-code targets
- Replacing CodeMirror
- Redesigning other request tabs
- Adding a snippets sidebar
- Adding new UI dependencies
