> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/feedback_best_model.md
> category: feedback

---

**Use the highest-quality Claude model and effort level for every task in this user's Claude Code sessions, without exception.** Default to Opus (latest available; currently Opus 4.7 / `claude-opus-4-7`) and `effortLevel: xhigh` (the highest persisted effort in Claude Code settings; `max` is API-only and not a valid persisted value).

**Why:** User explicitly stated this on 2026-05-16 as a 필수 지침 (mandatory directive) applied to 모든 작업 (all tasks). Quality outranks cost in this workspace. Do not auto-suggest downgrading to Sonnet/Haiku for cost reasons; if the user wants a cheaper model for a specific task, they will say so explicitly.

**How to apply:**

1. **Global settings** — `~/.claude/settings.json` should have `"model": "opus"` and `"effortLevel": "xhigh"`. Note: editing this file is blocked by the auto-mode classifier as "self-modification of agent config files" — the user must edit it manually (or via `/config`). If the file still shows lower values, remind the user once but do not block work.

2. **Subprocess / spawned `claude -p` calls** — pass `--model opus` (default in [[project_supabase]] code is already `opus` after the v06.23 changes). Do not silently downgrade.

3. **VCB enrichment / batch backfills** — exception class. The user previously chose Sonnet for one-off backfills to manage rate limits. If a similar one-off comes up where the user explicitly asks for a cheaper model, honor that explicit override — but never propose it preemptively.

4. **API code generated for the user** — default `model="claude-opus-4-7"` in any Anthropic SDK code. Do not write Sonnet/Haiku unless the user names it.

**Edge cases — when to confirm before downgrading:**
- A loop that will hit usage limits — surface the limit concern, propose options including Sonnet, let the user pick.
- A subagent / Explore spawn where Haiku is already the documented default — that is fine, that is Claude Code architecture, not a downgrade decision.

Related: [[project_supabase]] (project context), [[feedback_supabase_migrations]] (per-action confirmation pattern is the same shape).

