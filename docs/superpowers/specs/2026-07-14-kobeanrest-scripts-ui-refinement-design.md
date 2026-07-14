# KobeanREST Scripts UI Refinement Design

**Date:** 2026-07-14
**Status:** Approved

## Objective

Refine the entire request Scripts tab into a cleaner, smoother, and more professional workspace while preserving all current script behavior. The result should follow KobeanREST's restrained glass-inspired visual language, make the editor the primary focus, and reduce the visual weight of supporting tools.

## Scope

The refinement covers:

- The Pre-request and Post-request switcher
- The Save Scripts action
- Script type, formatting, and snippet controls
- Runtime and variable helper tokens
- The script editor frame and interaction states
- The generated request-code section
- The script output section
- Light theme, dark theme, and narrow-window behavior

The work will not change script persistence, execution order, formatting logic, snippet content, generated-code logic, or output semantics. It will not redesign the surrounding request builder.

## Visual Direction

Use a refined glass workspace with restrained translucency rather than stacking several equally prominent bordered cards. The editor is the visual centerpiece. Tooling is compact and quiet, while generated code and output remain available as secondary surfaces.

The design should use:

- Soft translucent surfaces with controlled contrast
- Fewer visible borders and a clearer elevation hierarchy
- Consistent control heights, radii, spacing, and typography
- Subtle blue focus and active states
- Short, smooth hover, focus, press, and disclosure transitions
- Equivalent hierarchy and legibility in light and dark themes

## Layout and Components

### Command Bar

The top row becomes a clean command bar. A compact segmented control for Pre-request and Post-request sits on the left. Save Scripts remains on the right as the strongest action in the surface, but it should stay restrained enough not to compete with the application-level Send action.

Both script tabs keep their current behavior and expose correct selected-state semantics. The save action retains its current handler and accessible label.

### Script Tools

Type selection, formatting, snippet selection, and insertion form one balanced toolbar. Controls use a shared 34-pixel height and consistent radii. Labels remain visible where they add clarity, while small icons may reinforce actions without replacing accessible text.

On narrower widths, the toolbar wraps into logical groups without clipping, horizontal page overflow, or controls becoming unusably small. The snippet selector receives remaining width before wrapping.

### Helper Tokens

Runtime helpers and environment-variable tokens remain a single horizontally scrollable row. They use compact code-style pills and distinct but subtle hover, focus-visible, and pressed states. Their existing insertion behavior is unchanged.

### Editor

The script editor occupies the largest visual area and becomes the workspace's primary surface. Its frame uses a clean border, a restrained shadow, and a subtle focus-within treatment. The editor gutter and active line should feel integrated with the application palette rather than appearing as a generic embedded control.

The existing CodeMirror editor, value flow, placeholder content, autocomplete variables, and ready callback remain unchanged. The refinement must not introduce a replacement editor or new editor state.

### Generated Code and Output

Generated request code and script output become secondary disclosure cards beneath the editor. Their headers remain visible and clearly labeled, while their bodies can be collapsed to reduce vertical clutter. Generated code keeps its target selector and insert action. Output keeps its empty, informational, and error states.

Disclosure state is presentation-only and local to the rendered Scripts tab. It must not alter generated content, execution results, or persisted request data. Native buttons with `aria-expanded` and clear labels provide keyboard-accessible toggles.

## Interaction and Motion

Interactive controls use 160-millisecond transitions for background, border, color, shadow, and disclosure changes. Motion clarifies state changes without drawing attention to itself.

All focusable elements must expose a visible focus indicator. Hover styling must not be the only way an active or selected state is communicated. Motion is reduced or removed under `prefers-reduced-motion: reduce`.

## Responsive Behavior

The layout should remain usable at desktop window widths supported by the existing application:

- The command bar keeps the segmented control and save action readable.
- Tool groups wrap in a predictable order.
- Helper tokens scroll horizontally inside their own row.
- Editor content remains the dominant flexible region.
- Disclosure-card headers wrap without overlapping their actions.
- No component creates horizontal overflow in the request panel.

## Themes and Accessibility

Light and dark themes use theme-aware surfaces, border contrast, shadows, and editor colors. Text and controls must remain legible over translucent backgrounds. Selected tabs, focus rings, output errors, and disclosure states cannot rely on color alone.

Existing accessible names remain intact. New disclosure controls use native buttons, meaningful labels, and `aria-expanded`. The implementation should preserve keyboard navigation order and avoid clickable non-button containers.

## Error Handling and Data Flow

This is a presentation refinement. Current handlers and data flow remain authoritative:

1. The active script selects the current editor value.
2. Tool actions format or insert content through existing handlers.
3. Save Scripts persists the current pre-request and post-request values through the existing save path.
4. Generated code continues to derive from the current draft request.
5. Execution output continues to display existing informational and error entries.

Collapsing a secondary card only hides its body. It does not clear, recompute, or modify its data. Existing error messages remain visible when the Output card is expanded and retain their error styling.

## Verification

Implementation verification will include:

- Contract tests for retained controls, accessible labels, disclosure semantics, and required style hooks
- Unit coverage for any isolated presentation-state helper only if one is introduced
- The full Node test suite
- TypeScript and production build validation
- Interactive browser inspection of the Scripts tab in light and dark themes
- Narrow-window inspection for toolbar wrapping, helper scrolling, editor sizing, and disclosure headers
- Keyboard inspection for tab order, focus-visible states, segmented selection, and disclosure controls

## Non-goals

- Changing script execution capabilities or security boundaries
- Adding new script languages, snippets, or generated-code targets
- Replacing CodeMirror
- Changing how scripts are stored or loaded
- Redesigning the response dock or other request tabs
- Introducing animation libraries or new UI dependencies
