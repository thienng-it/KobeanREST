# KobeanREST Docs Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public GitHub Pages documentation portal for KobeanREST with a main portal page, focused inner pages, and a professional glassmorphism UI.

**Architecture:** Create an isolated Vite + React docs app under `docs-site/` using hash routing so GitHub Pages deep links do not break. Keep content in typed modules, render it through a shared app shell and page layout, then wire the desktop app’s Docs button to the public portal URL.

**Tech Stack:** React, Vite, TypeScript, CSS, existing repo Node toolchain, GitHub Actions

## Global Constraints

- Public static site for GitHub Pages.
- Separate from the desktop app runtime.
- Reuse and polish existing repo documentation as the source material.
- Expand thin sections where needed so the portal feels complete.
- Keep product-facing sections understandable to non-developers.
- Keep developer and release sections structured and operational.
- Avoid heavy docs frameworks unless they materially reduce code and maintenance.

---

### Task 1: Scaffold the Isolated Docs App

**Files:**
- Create: `docs-site/package.json`
- Create: `docs-site/tsconfig.json`
- Create: `docs-site/vite.config.ts`
- Create: `docs-site/index.html`
- Create: `docs-site/src/main.tsx`
- Create: `docs-site/src/App.tsx`
- Create: `docs-site/src/styles.css`
- Test: `npm --prefix docs-site run build`

**Interfaces:**
- Consumes: existing repo React/Vite dependency versions from root `package.json`
- Produces: standalone docs-site app entrypoint and build output

- [x] Step 1: Create the failing build surface by adding the docs-site files without implementation.
- [x] Step 2: Run `npm --prefix docs-site run build`.
- [x] Step 3: Confirm it fails because the docs-site app is incomplete.
- [x] Step 4: Add the minimal docs-site Vite scaffold and base styles so the build can run.
- [x] Step 5: Re-run `npm --prefix docs-site run build` and confirm it passes.

### Task 2: Build Shared Portal Shell and Hash Routing

**Files:**
- Modify: `docs-site/src/App.tsx`
- Create: `docs-site/src/site.ts`
- Create: `docs-site/src/components/AppShell.tsx`
- Create: `docs-site/src/components/PortalCard.tsx`
- Create: `docs-site/src/components/SectionNav.tsx`
- Create: `docs-site/src/components/DocsPageLayout.tsx`
- Modify: `docs-site/src/styles.css`
- Test: `npm --prefix docs-site run build`

**Interfaces:**
- Consumes: docs-site app scaffold from Task 1
- Produces:
  - `parseRoute(hash: string): SiteRoute`
  - `AppShell`
  - `DocsPageLayout`

- [x] Step 1: Add a failing contract test or route assertion surface by defining the intended routes in code before the pages exist.
- [x] Step 2: Implement a tiny hash-routing layer with routes for `home`, `product`, `downloads`, `developer`, `release`, `roadmap`, and `qa`.
- [x] Step 3: Build the shared header, footer, portal container, and inner-page layout with sidebar anchors.
- [x] Step 4: Add the glassmorphism design tokens, typography, spacing, cards, tables, code blocks, and responsive behavior.
- [x] Step 5: Run `npm --prefix docs-site run build` and confirm the routed shell compiles.

### Task 3: Add Structured Documentation Content

**Files:**
- Create: `docs-site/src/content/product.ts`
- Create: `docs-site/src/content/downloads.ts`
- Create: `docs-site/src/content/developer.ts`
- Create: `docs-site/src/content/release.ts`
- Create: `docs-site/src/content/roadmap.ts`
- Create: `docs-site/src/content/qa.ts`
- Create: `docs-site/src/content/shared.ts`
- Test: `node --test tests/docs-site-contract.test.mjs`

**Interfaces:**
- Consumes:
  - current repo docs from `README.md`
  - `docs/download.md`
  - `docs/release-operations.md`
  - `docs/implementation-roadmap.md`
  - `docs/release-qa.md`
  - `docs/known-issues.md`
- Produces typed content blocks used by page components

- [x] Step 1: Write a failing docs contract test that expects the docs-site content modules and key public copy areas to exist.
- [x] Step 2: Extract and rewrite the product content into structured data for product-facing sections.
- [x] Step 3: Extract and rewrite the downloads, developer, release, roadmap, and QA content into separate modules.
- [x] Step 4: Keep the copy accurate to the current verified repo state, expanding thin sections without inventing unsupported features.
- [x] Step 5: Run `node --test tests/docs-site-contract.test.mjs` and confirm the content contract passes.

### Task 4: Implement Portal Home and Inner Pages

**Files:**
- Modify: `docs-site/src/App.tsx`
- Create: `docs-site/src/pages/HomePage.tsx`
- Create: `docs-site/src/pages/ProductPage.tsx`
- Create: `docs-site/src/pages/DownloadsPage.tsx`
- Create: `docs-site/src/pages/DeveloperPage.tsx`
- Create: `docs-site/src/pages/ReleasePage.tsx`
- Create: `docs-site/src/pages/RoadmapPage.tsx`
- Create: `docs-site/src/pages/QaPage.tsx`
- Modify: `docs-site/src/styles.css`
- Test: `npm --prefix docs-site run build`

**Interfaces:**
- Consumes:
  - routing and layouts from Task 2
  - content modules from Task 3
- Produces complete portal home and inner-page renders

- [x] Step 1: Implement the portal home page with hero, trust strip, snapshot cards, and directory cards.
- [x] Step 2: Implement the focused inner pages using the shared `DocsPageLayout`.
- [x] Step 3: Add reusable sections for callouts, code blocks, tables, and status cards instead of page-specific one-offs.
- [x] Step 4: Tune responsive behavior so the site stays readable on desktop and mobile.
- [x] Step 5: Run `npm --prefix docs-site run build` and confirm the full portal compiles.

### Task 5: Wire Repo Integration and Deployment

**Files:**
- Modify: `src/renderer/src/product-contract.ts`
- Modify: `src/renderer/src/App.tsx`
- Modify: `tests/local-only-contract.test.mjs`
- Modify: `package.json`
- Create: `.github/workflows/docs-site.yml`
- Create: `tests/docs-site-contract.test.mjs`
- Test: `node --test tests/docs-site-contract.test.mjs tests/local-only-contract.test.mjs`

**Interfaces:**
- Consumes:
  - public docs portal URL
  - docs-site build command
- Produces:
  - desktop Docs button points at portal URL
  - GitHub Pages deploy workflow
  - repo-level docs-site test coverage

- [x] Step 1: Add a failing repo contract test that expects a docs-site build command, deploy workflow, and Docs button portal URL.
- [x] Step 2: Point the desktop Docs button at the public portal URL instead of the release downloads URL.
- [x] Step 3: Add root scripts for building the docs site.
- [x] Step 4: Add a GitHub Pages workflow that installs dependencies, builds `docs-site`, and publishes the static output.
- [x] Step 5: Run the targeted tests and confirm the repo integration contract passes.

### Task 6: Verify End to End

**Files:**
- Modify: `docs/superpowers/plans/2026-07-05-kobeanrest-docs-portal-implementation.md`

**Interfaces:**
- Consumes all previous tasks
- Produces a verified working docs-site implementation

- [x] Step 1: Run `node --test tests/docs-site-contract.test.mjs tests/local-only-contract.test.mjs`.
- [x] Step 2: Run `npm test`.
- [x] Step 3: Run `npm run build`.
- [x] Step 4: Run `npm run build:docs`.
- [x] Step 5: Update this plan’s checkboxes mentally and summarize any remaining intentional gaps.
