# KobeanSkills — Upstream Sources & Provenance Lock

This file records the exact upstream repositories, commits, and licenses from which `KobeanSkills` distills its methodologies, role contracts, and reference checklists.

> **Security Policy (Air-Gap):**
> 1. None of these upstream repositories are ever symlinked into `~/.gemini/config/skills/` or `~/.claude/skills/`.
> 2. Zero executable scripts (`.py`, `.sh`, `.mjs`, `.js`) or lifecycle `hooks.json` files are copied from upstreams.
> 3. Runtime skills (`skills/kb-*/`) never read from `vendor/` at execution time.

## Pinned Upstreams (Audited 2026-11-11)

| Upstream Repository | Pinned Commit SHA | Commit Date | License | Used For (Distilled Into) |
| :--- | :--- | :--- | :--- | :--- |
| [obra/superpowers](https://github.com/obra/superpowers) | `22f0b463e7a5e579904dd6211a520321035526f7` | 2026-11-03 | MIT | Process backbone: Socratic brainstorming, task decomposition, subagent-driven development, Red-Green-Refactor TDD, systematic debugging, verification gates (`kb-spec`, `kb-plan`, `kb-build`, `kb-debug`, `kb-review`, `kb-ship`). |
| [github/spec-kit](https://github.com/github/spec-kit) | `40dd00f39763ccf653ccb18deb684d006f522176` | 2026-11-11 | MIT | Artifact templates & Spec-Driven lifecycle: `constitution.md`, `spec.md`, `plan.md`, cross-artifact consistency analysis (`kb-spec`, `kb-plan`, `templates/`). |
| [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) | `96608e078b2d5ea607c5c3b8b5a54d1c1fba6846` | 2026-10-29 | MIT | YAGNI minimal-change doctrine (`lite`/`full`/`ultra`), diff review, repo audit, technical debt ledger (`doctrine.md`, `kb-build`, `kb-review`, `roles/refactorer.yaml`). |
| [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | `c1e0e5492fbb524f5df84d635ecfae7dc438ec45` | 2026-11-10 | Apache-2.0 | Primary UI/UX design doctrine, `PRODUCT.md` convention, anti-slop hard bans, critique/audit vocabulary (`kb-ui`, `roles/ui-ux-designer.yaml`, `references/design/`). |
| [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | `f6b76575f949707b4e3c37cd86cb44b0b98643e8` | 2026-11-07 | MIT | Opt-in `bold` art-direction mode: 1-section-per-screen rhythm, equal edges, dealt visual moments, micro-interactions (`kb-ui`, `references/design/`). |
| [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | `6ae86f61f520d6ca229d2f40e070410638c908c5` | 2026-11-10 | MIT | Reference-only lookup catalog for industry color systems, font pairings, and layout patterns (`references/design/`). |
| [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | `301b02b12bff98e4688e6984af6556802322bbde` | 2026-11-01 | MIT | Craft reference library: API & interface design, ADRs, CI/CD & automation, observability, code simplification, shipping & launch (`roles/api-designer.yaml`, `roles/devops.yaml`, `roles/release-manager.yaml`). |
| [addyosmani/web-quality-skills](https://github.com/addyosmani/web-quality-skills) | `afa8da942115f2961fdbfa80807ea0b232ff6c00` | 2026-08-24 | MIT | Measurement-first Core Web Vitals (`LCP <= 2.5s`, `INP <= 200ms`, `CLS <= 0.1`) and WCAG 2.2 accessibility auditing (`roles/performance.yaml`, `roles/a11y-auditor.yaml`, `references/checklists/`). |
| [trailofbits/skills](https://github.com/trailofbits/skills) | `e4dd0bb5b15535f7c5a0834187dffba6ac37e4ff` | 2026-11-06 | CC-BY-SA-4.0 | Security auditing methodologies: differential review, insecure defaults, sharp edges, false-positive gate (`fp-check`), supply-chain risk, CI/CD agentic actions auditing (`roles/security.yaml`, `roles/supply-chain.yaml`, `roles/reviewer.yaml`). |
| [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | `1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62` | 2026-10-27 | Unspecified | React & Next.js performance rules (async waterfalls, bundle size, RSC boundaries) and web design guidelines (`references/stacks/nextjs.md`, `roles/frontend.yaml`). |
| [anthropics/skills](https://github.com/anthropics/skills) | `2c5958ecac7cee2b583967a2c4981d0f4a75c579` | 2026-11-06 | Mixed | `doc-coauthoring` 3-stage workflow + reader-test verification, `webapp-testing` Playwright patterns (`roles/tech-writer.yaml`, `roles/qa.yaml`). |
| [supabase/agent-skills](https://github.com/supabase/agent-skills) | `c9be0e931b7930f7d02126d04774d904c381e7d7` | 2026-10-02 | MIT | PostgreSQL schema design, indexing (GIN/partial/composite), query plans, connection pooling, safe migrations (`references/stacks/postgres-drizzle.md`, `roles/data-engineer.yaml`). |
| [expo/skills](https://github.com/expo/skills) | `a9e5bd3fa00b4e61f632e43f85da73aee1942582` | 2026-11-01 | MIT | Official Expo Router, native UI patterns, dev client, SDK upgrades, EAS build/submit workflows (`references/stacks/expo.md`, `roles/mobile.yaml`). |
| [callstackincubator/agent-skills](https://github.com/callstackincubator/agent-skills) | `59e9d17446a248b21d86f078fcd0bd2d36db1ca4` | 2026-10-08 | MIT | React Native FPS/re-render optimization, FlashList, bundle size, TTI, Hermes profiling (`references/stacks/expo.md`, `roles/mobile.yaml`). |
| [huggingface/skills](https://github.com/huggingface/skills) | `25910b3d0ba31a2ba102f901cdc9e008c278a69c` | 2026-10-29 | Apache-2.0 | ML/AI dataset engineering, evaluation harnesses, TRL fine-tuning (SFT/DPO/GRPO), experiment tracking (`references/stacks/python-fastapi.md`, `roles/ml-engineer.yaml`). |
| [mrwadams/stride-gpt](https://github.com/mrwadams/stride-gpt) | `00e13a5daf61d23865a1d6c56eab2f77696fffa3` | 2026-11-08 | MIT | STRIDE threat modeling, trust boundary mapping, DREAD risk scoring, attack trees (`roles/threat-modeler.yaml`, `templates/threats.md`). |

## Vetted Local CLI & MCP Tools

| Tool | Source | Purpose |
| :--- | :--- | :--- |
| `bd` (Beads) | [gastownhall/beads](https://github.com/gastownhall/beads) | Single source of truth for task graph, dependencies, and ready-work detection (`.beads/`). |
| `graphify` | [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify) | Tree-sitter structural AST + concept graph for repository orientation (`graphify-out/`). |
| `betterleaks` | [betterleaks/betterleaks](https://github.com/betterleaks/betterleaks) | Secret detection and validation gate. |
| `osv-scanner` | [google/osv-scanner](https://github.com/google/osv-scanner) | Supply-chain lockfile/manifest CVE scanning. |
| `semgrep` | [semgrep/semgrep](https://github.com/semgrep/semgrep) | Static analysis security rules. |
| `chrome-devtools-mcp` | Native Antigravity Plugin | Live DOM, accessibility tree, Core Web Vitals traces, and console/network inspection. |

