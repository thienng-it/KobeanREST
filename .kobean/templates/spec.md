# Feature Specification: <Feature Name>

- **Spec ID:** `specs/NNN-<slug>/spec.md`
- **Status:** `Draft | Clarified | Approved | Implemented`
- **Date:** `YYYY-MM-DD`
- **Mode:** `Greenfield | Brownfield Delta`

## 0. Ponytail Ultra Gate ("Should This Exist?")
- **Problem Statement:** What breaks or hurts today if we do nothing?
- **Existing Alternatives Checked:** Can existing code, config, or standard library features solve this with zero new surface area?
- **Smallest Viable Scope:** What did we explicitly cut from the initial idea?

## 1. User Scenarios & Acceptance Criteria

### Scenario 1 — <Title> (Priority: P1)
- **Given** <precondition>
- **When** <action>
- **Then** <observable outcome>

## 2. Delta Summary (Brownfield Only — OpenSpec Style)
- **ADDED:** <new endpoints, UI views, tables, or behaviors>
- **MODIFIED:** <existing files/behaviors changing and why>
- **REMOVED:** <deprecated code or features being deleted>

## 3. Edge Cases & Failure Modes
- **Invalid / Empty Input:** <expected behavior>
- **Network / Upstream Failure:** <expected recovery or error state>
- **Concurrency / Race Conditions:** <expected behavior>
- **Security / Trust Boundary:** Does this touch Auth, Payments, PII, or External Secrets? (`Yes -> require threats.md` / `No`)

## 4. Out of Scope
- <explicitly excluded item>

