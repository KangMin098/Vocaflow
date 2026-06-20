> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_supabase.md
> category: project

---

- **vocaflow-dev project_id**: `jajenrevcbmrpaliomxv` (region ap-northeast-2, Postgres 17). A second project `ndhjncjdnpssasthzqeg` (Weekly Planner) exists but is unrelated.
- **`shared_dictionary.ngsl_sfi`**: already added as `NUMERIC(5,2)` by an earlier MCP migration (Phase 14.1). Do NOT re-add as REAL — NUMERIC(5,2) is accurate enough for SFI (30~88 range, 2 decimals) and the import script writes numeric values that NUMERIC accepts.
- **`shared_dictionary.frequency_rank`**: `INT`, nullable, partial index `WHERE frequency_rank IS NOT NULL` (idx_dict_freq). Phase 14.1 fills this from NGSL.

**Why:** The user has already paid the cost of these migrations once; redoing them risks type conflicts or migration history clutter. Confirmed by the user 2026-05-11.

**How to apply:** Before issuing any `ALTER TABLE shared_dictionary` migration via `mcp__claude_ai_Supabase__apply_migration`, check `list_tables` or recall this memory. If the column already exists, skip the migration entirely.

