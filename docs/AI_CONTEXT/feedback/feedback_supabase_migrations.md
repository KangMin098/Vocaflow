> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/feedback_supabase_migrations.md
> category: feedback

---

Never call `mcp__claude_ai_Supabase__apply_migration` (or other DDL/data-mutating MCP tools) without an explicit, scoped go-ahead for that specific migration in the current turn.

**Why:** A general "마이그레이션만" answer is not enough — Anthropic's auto-mode classifier denies it, and the user has previously had migrations applied behind their back that conflicted with prior state (e.g. ngsl_sfi already existed as NUMERIC(5,2) when a script tried to re-add as REAL). The user values reviewing the exact SQL + target project + reversibility before each apply.

**How to apply:**
1. Show the SQL, target `project_id`, side-effects (idempotency / data loss / rollback) in chat.
2. Ask via `AskUserQuestion` with options like "예, 적용 / 아니요, 수동 (Studio에서 직접)".
3. Only after an explicit "예, 적용" call `apply_migration`.
4. For schema changes that may already be in place, recall `project_supabase.md` first.

