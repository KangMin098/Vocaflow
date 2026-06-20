> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/feedback_claude_code_is_llm.md
> category: feedback

---

Claude Code (this agent) **is** an Anthropic LLM (Opus/Sonnet). When the user asks for "Claude-based classification / enrichment / judgment" tasks, do NOT propose using the Anthropic API or `@anthropic-ai/sdk` — that would be calling another LLM from inside an LLM, redundant and wasteful.

**Why**: I repeatedly proposed Anthropic API workflows (e.g., $96 for 3,202 words, RPM limits, API keys) when the user said "Claude Code 배치 작업" — meaning use Claude Code itself. User had to correct me twice (once around dict-fill, again on VRL classification 2026-05-23). The semantic mismatch wastes user trust and budget reasoning.

**How to apply**:
- For tasks like "Claude 가 단어 분류 / 의미 매핑 / 한국어 뜻 작성 / 어휘 enrichment":
  - I (Claude Code) read the data via Supabase MCP / Read tool
  - I produce the classification/text/judgment in my response or in SQL UPDATE statements
  - I write results via Supabase MCP `execute_sql` / `apply_migration`
  - No API key, no SDK, no per-word cost, no rate limits other than my own response turns
- Batch size: ~100-200 items per response turn (context-bound)
- User-driven cadence: each batch is one turn; user confirms before next batch
- Time estimate: report in turns, not hours
- Cost estimate: $0 in API spend (the cost is the Claude Code session itself)

**When Anthropic SDK IS appropriate** (rare):
- Building a user-facing feature that needs LLM at runtime in production (not dev-time enrichment)
- Background jobs the user wants running independently of an interactive session
- Always confirm with user first — don't default to it

Related: [[feedback-best-model]] (use Opus, don't downgrade).

