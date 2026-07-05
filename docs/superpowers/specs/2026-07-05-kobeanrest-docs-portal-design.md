# KobeanREST Docs Portal Design

Date: 2026-07-05
Status: proposed
Scope: public GitHub Pages documentation portal

## Goal

Build a professional public documentation website for KobeanREST that covers:

- product overview
- downloads and install guidance
- developer setup and architecture
- release operations
- roadmap and QA
- known issues and troubleshooting

The site should feel like one unified documentation portal, not a loose set of Markdown pages. The visual direction is Apple-inspired glassmorphism, but restrained: light-first, elegant, high-clarity, simple, and readable.

## Constraints

- Public static site for GitHub Pages.
- Separate from the desktop app runtime.
- Reuse and polish existing repo documentation as the source material.
- Expand thin sections where needed so the portal feels complete.
- Keep product-facing sections understandable to non-developers.
- Keep developer and release sections structured and operational.
- Avoid heavy docs frameworks unless they materially reduce code and maintenance.

## Recommended Approach

Build a small Vite-based static docs app under `docs-site/` with shared layout, shared tokens, and simple client-side routing. The site will be deployed independently to GitHub Pages and will not be coupled to the Tauri desktop UI.

Why this approach:

- lighter than adopting a full docs framework
- easy to control the visual system
- keeps the repo’s existing React/Vite familiarity
- clean separation from the desktop app
- practical for a custom portal home plus focused inner pages

## Information Architecture

### Primary Pages

1. `Home`
   The portal landing page with project summary, quick links, trust signals, and the main documentation directory.

2. `Product`
   What KobeanREST is, who it is for, local-first model, privacy stance, core capabilities, and no-account contract.

3. `Downloads`
   Public installers, platform notes, checksum verification, update behavior, and release links.

4. `Developer`
   Stack, local setup, commands, app structure, desktop/runtime split, persistence, secrets, and development flow.

5. `Release`
   Release workflow, signing context, preflight checks, GitHub Actions release flow, and operational links.

6. `Roadmap`
   Implementation phases, shipped status, current verified scope, and known forward work.

7. `QA & Issues`
   Release QA checklist, troubleshooting guidance, and known issues.

### Navigation Model

- Top-level global nav in the header for all main pages.
- Home page uses large directory cards to branch into sections.
- Inner pages use a left-side local section nav with anchors for long content.
- Mobile collapses to a sticky top bar with a slide-down section menu.

## Content Mapping

### Home

- Hero: project identity, local-first positioning, short description.
- Three primary trust points:
  - no account required
  - local SQLite plus secure secret storage
  - signed release/update flow
- Quick-entry cards:
  - Product
  - Downloads
  - Developer
  - Release
  - Roadmap
  - QA & Issues
- “Current snapshot” area summarizing release version, platform support, and roadmap completion status.

### Product

- What KobeanREST is
- Why local-first matters
- Supported request authentication types
- Privacy and storage model
- Boundaries and out-of-scope items

### Downloads

- Latest release entry point
- Platform matrix
- Checksum verification
- Update behavior
- Installation notes

### Developer

- Stack and architecture summary
- Setup commands
- Runtime split between renderer and native core
- Persistence and secret boundaries
- Common workflow commands

### Release

- Release preflight
- Signing requirements
- Tagging and publishing flow
- GitHub Actions workflow behavior
- Post-release verification

### Roadmap

- Phase list from implementation roadmap
- Completed vs active status framing
- Notes on verification and scope

### QA & Issues

- Manual release QA checklist
- Known issues
- Troubleshooting notes

## Visual System

### Style Direction

- Light-first background with cold white, pale slate, and soft blue-gray layering.
- Glass panels with subtle blur, thin borders, faint highlights, and restrained shadows.
- Large spacing, precise alignment, and a premium editorial feel.
- Minimal accent color, used sparingly for links, active states, and important callouts.

### Typography

- Serif or neo-grotesk pairing with more character than default system stacks.
- Large calm headings.
- Compact UI chrome text.
- Comfortable reading measure on inner pages.

### Components

- Glass header
- Portal cards
- Sidebar nav
- Section callout panels
- Code blocks
- Status cards
- Documentation tables
- Anchor links

### Motion

- Soft fade and lift on entry
- Mild hover transitions on cards and nav
- No decorative motion that slows reading

## Technical Design

### Directory

- `docs-site/`
  - `index.html`
  - `src/`
  - `public/`
  - `vite.config.ts`

### App Structure

- `AppShell`
  Shared header, footer, page frame, and mobile nav.

- `PortalHomePage`
  Home portal layout and summary cards.

- `DocsPageLayout`
  Shared inner-page layout with sidebar nav and anchor sections.

- Page modules:
  - `HomePage`
  - `ProductPage`
  - `DownloadsPage`
  - `DeveloperPage`
  - `ReleasePage`
  - `RoadmapPage`
  - `QaIssuesPage`

- Shared UI primitives:
  - `GlassPanel`
  - `SectionHeader`
  - `StatusPill`
  - `DocsTable`
  - `CodeBlock`
  - `PortalCard`

### Data Model

Use repo-local structured content modules instead of runtime Markdown parsing for v1. This keeps the site simple and predictable.

- `src/content/product.ts`
- `src/content/downloads.ts`
- `src/content/developer.ts`
- `src/content/release.ts`
- `src/content/roadmap.ts`
- `src/content/qa.ts`

Each module exports typed content blocks assembled from the current docs plus polished additions where needed.

### Routing

Use simple client-side routing suitable for GitHub Pages. Each page has a stable path from the portal home.

Target routes:

- `/`
- `/product`
- `/downloads`
- `/developer`
- `/release`
- `/roadmap`
- `/qa`

If hash routing is safer for Pages in this repo, prefer hash routing over broken deep links.

## Error Handling

- Unknown routes fall back to the portal home or a clean not-found state.
- Missing content sections should render safe placeholders only in development; production should ship with complete content.
- External links open safely with clear labels where needed.

## Testing and Verification

Minimum verification:

- `npm test` for existing repo tests
- `npm run build` for current app
- docs site build command
- targeted contract test for docs-site presence and core routes/content references

Visual verification:

- desktop viewport
- mobile viewport
- portal home
- one representative inner page
- navigation between portal and section pages

## Rollout Plan

1. Scaffold isolated docs site.
2. Build shared design system and layout shell.
3. Implement portal home.
4. Implement inner page template.
5. Port and polish content into content modules.
6. Add GitHub Pages deployment support.
7. Verify locally and refine visuals.

## Explicit Non-Goals

- No embedding the docs site inside the desktop app in this phase.
- No search backend.
- No CMS.
- No heavy docs framework migration unless current approach fails.
- No account/auth documentation because the product has no user-account system.

