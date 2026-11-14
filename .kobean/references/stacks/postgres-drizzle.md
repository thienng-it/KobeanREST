# Stack Reference: PostgreSQL + Drizzle ORM

> Distilled from `supabase/agent-skills` (`supabase-postgres-best-practices`) and safe migration patterns.

## 1. Schema Design & Data Types (`CRITICAL`)
- **Primary Keys & Timestamps:** Use `bigint` identity (`generatedAlwaysAsIdentity()`) or UUIDv7 for primary keys. Always include `created_at` and `updated_at` (`timestamptz`, `defaultNow()`).
- **Optimal Types:** Use `text` instead of arbitrary `varchar(n)` (add `CHECK (char_length(col) <= n)` when a limit matters). Use `numeric` / integer cents for money—never `real` or `double precision`.
- **Foreign Keys:** Always declare explicit `REFERENCES` with intentional `ON DELETE` behavior (`CASCADE` or `RESTRICT`), and **always index foreign key columns** (Postgres does not auto-index FKs).

## 2. Indexing Strategy (`HIGH`)
- **Match Query Patterns:** Add B-Tree indexes for equality/range filters and sort columns (`WHERE tenant_id = $1 ORDER BY created_at DESC` -> composite `(tenant_id, created_at DESC)`).
- **Specialized Indexes:**
  - `GIN` index for `jsonb` containment (`@>`) or full-text search (`tsvector`).
  - **Partial Indexes** (`WHERE deleted_at IS NULL` or `WHERE status = 'pending'`) to keep hot indexes small and fast.
- **Verify with `EXPLAIN (ANALYZE, BUFFERS)`:** Any query over a growing table must avoid sequential scans (`Seq Scan`) on large row counts.

## 3. Safe Migrations & Drizzle Rules (`CRITICAL`)
- **Never Edit Committed Migrations:** Generate migrations via `drizzle-kit generate` and commit both schema and SQL files under `migrations/`.
- **Zero-Downtime Expand/Contract:**
  - Never rename a column or table in a single step in production. Add new column -> dual-write / backfill -> switch reads -> drop old column in a later release.
  - Add new constraints as `NOT VALID` first, then `VALIDATE CONSTRAINT` to avoid long `ACCESS EXCLUSIVE` table locks.
- **Transactions & N+1 Prevention:** Wrap multi-table writes in `db.transaction(async (tx) => ...)`. Never run `db.select` inside a `for` loop—use `inArray`, joins, or relational queries.

