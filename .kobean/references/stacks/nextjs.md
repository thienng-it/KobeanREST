# Stack Reference: Next.js (App Router) + React + Tailwind

> Distilled from `vercel-labs/agent-skills` (`react-best-practices`, `composition-patterns`, `web-design-guidelines`) and `addyosmani/agent-skills` (`frontend-ui-engineering`).

## 1. Async Waterfalls & Data Fetching (`CRITICAL`)
- **Ban Sequential Awaits:** Never chain independent `await fetchA(); await fetchB();` in Server Components or Route Handlers. Use `Promise.all([fetchA(), fetchB()])`.
- **Stream Non-Critical Data:** Wrap slow secondary sections in `<Suspense fallback={<Skeleton />}>` instead of blocking the entire route shell.
- **Colocate or Preload:** Fetch data in Server Components at the layout/page boundary; pass serializable props down to Client Components.

## 2. Server vs. Client Boundaries (`CRITICAL`)
- **Default to Server Components:** Only add `'use client'` at the lowest interactive leaf node (e.g., `<SearchInput />`, not the entire `<Header />`).
- **Bundle Size Discipline:** Never import heavy server/utility libraries (`lodash`, full icon packs, markdown parsers) into `'use client'` modules.
- **Server Actions & Mutations:** Validate every input payload with Zod at the start of every Server Action or Route Handler; never trust client state.

## 3. Rendering & State Hygiene (`HIGH`)
- **Derived State:** Compute derived values during render (`const fullName = ...`). Never sync props or state into another `useState` via `useEffect`.
- **Composition over Boolean Props:** Prefer compound components or explicit variant components over components with 6+ boolean flags (`isCompact`, `isModal`, `hideFooter`).
- **URL as State:** Store shareable filter, sort, pagination, and tab state in URL search params (`useSearchParams`), not ephemeral `useState`.

## 4. UI States & Accessibility (`MANDATORY`)
- Every async surface must explicitly implement 4 states: `loading` (skeleton matching layout dimensions to keep `CLS <= 0.1`), `empty` (clear call to action), `error` (human-readable retry), and `populated`.
- Use semantic HTML (`<button>`, `<nav>`, `<main>`, `<dialog>`) before ARIA.
- Always style `:focus-visible` (never strip focus outlines without a high-contrast replacement).

