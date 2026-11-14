# Release, Documentation & Shipping Checklist

> Distilled from `addyosmani/agent-skills` (`shipping-and-launch`, `git-workflow-and-versioning`, `documentation-and-adrs`), `anthropics/skills` (`doc-coauthoring`), and Diátaxis.

## 1. Pre-Release Gate (`release-manager`)
- [ ] `bd ready` / `bd list` shows zero open blocker issues for this milestone.
- [ ] Full test suite passes cleanly (`vitest`, `playwright`, `pytest`).
- [ ] `betterleaks git -v` reports 0 secrets.
- [ ] Supply-chain audit (`osv-scanner` / `npm audit --omit=dev`) reports 0 unmitigated `CRITICAL`/`HIGH` CVEs.
- [ ] Database migrations (if any) are backward-compatible and tested against a clean + seeded DB.
- [ ] Rollback plan documented: exact git tag/commit to revert to and whether DB migrations are reversible.

## 2. Versioning & Changelog (`release-please` / `git-cliff` conventions)
- Commits follow **Conventional Commits**: `feat(scope):`, `fix(scope):`, `perf(scope):`, `refactor(scope):`, `docs:`, `chore:`.
- Semantic Versioning (`MAJOR.MINOR.PATCH`):
  - `MAJOR` (`feat!:` / `BREAKING CHANGE:`): incompatible API/schema change.
  - `MINOR` (`feat:`): backward-compatible capability.
  - `PATCH` (`fix:` / `perf:`): backward-compatible bug or perf fix.
- `CHANGELOG.md` groups user-visible changes under **Added**, **Changed**, **Fixed**, **Security**, and **Breaking Changes** with commit/issue references.

## 3. Diátaxis Documentation Rules (`tech-writer`)
Never mix the 4 documentation quadrants in a single section:
1. **Tutorials (Learning + Action):** Step-by-step guided first run for a newcomer. No deep theory.
2. **How-To Guides (Working + Action):** Recipe for a specific goal (e.g., *"How to add a new OAuth provider"*). Prerequisites -> exact steps -> verification command.
3. **Reference (Working + Cognition):** Fact-dense, scannable tables of CLI flags, env vars, API endpoints, and error codes.
4. **Explanation / ADRs (Understanding + Cognition):** *Why* the system is designed this way (`docs/adr/ADR-NNN-*.md`).

## 4. Reader-Test Verification (`doc-coauthoring`)
Before marking docs complete, verify every command and file path in the documentation against the actual repository so a fresh reader with zero context can copy-paste and succeed on the first try.

