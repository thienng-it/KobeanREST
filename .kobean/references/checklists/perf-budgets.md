# Performance & Core Web Vitals Budgets

> Distilled from `addyosmani/web-quality-skills` (`performance`, `core-web-vitals`) and `vercel-labs/agent-skills` (`react-best-practices`).
> **Antigravity Integration:** Pair with the installed `debug-optimize-lcp` skill and `chrome-devtools-mcp` (`performance_start_trace`, `performance_stop_trace`, `lighthouse_audit`).

## 1. Core Web Vitals Hard Budgets (75th Percentile / Local Lab Target)
- **LCP (Largest Contentful Paint):** `<= 2.5s` (Target `< 1.8s` in local lab)
  - Hero image or primary heading must be discoverable in initial HTML response (never lazy-load the LCP image; add `fetchPriority="high"` / `priority`).
  - Zero render-blocking third-party scripts in `<head>`.
- **INP (Interaction to Next Paint):** `<= 200ms`
  - Keep main-thread tasks under `50ms`. Yield or debounce expensive filtering/search handlers; avoid cascading React re-renders.
- **CLS (Cumulative Layout Shift):** `<= 0.1` (Target `0.00` in local lab)
  - Every `<img>`, `<video>`, iframe, and async skeleton must reserve explicit `width`/`height` or `aspect-ratio`.
  - Web fonts must use `font-display: swap` or `optional` with size-adjusted fallback metrics.

## 2. Bundle & Network Budgets
- **Initial JS Bundle (compressed per route):** `<= 170 KB` gzipped.
- **API Latency (p95 local/staging):** `<= 150ms` for reads, `<= 300ms` for writes.
- **Database Queries per Request:** `<= 3` round-trips (0 N+1 loops).

## 3. Measurement-First Rule
Never guess or apply blind micro-optimizations:
1. Record baseline metric (`chrome-devtools-mcp` trace, Lighthouse, or `EXPLAIN ANALYZE`).
2. Identify the single dominant bottleneck.
3. Apply the smallest fix.
4. Re-measure and report `before -> after` numbers.

