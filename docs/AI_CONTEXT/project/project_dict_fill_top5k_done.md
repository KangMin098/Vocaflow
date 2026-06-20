> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_dict_fill_top5k_done.md
> category: project

---

The dict-fill sprint (PR #16, `docs/dict-fill-sprint-plan` branch) ran to completion on 2026-05-17. After cast-2000 promote (PR #13) + this sprint, `shared_dictionary` is fully filled on `example_en` / `ipa` / `collocations` / `synonyms` / `antonyms` for **the entire Top 5K by NGSL frequency_rank** (4,026 rows).

**Why:** Unblock high-quality vocab set builds that pull from `shared_dictionary` master cache for the most-common 5K English words. Anything beyond rank 5000 (or with no NGSL rank) is intentionally lazy.

**How to apply:**
- Treat the rank≤5000 subset of `shared_dictionary` as production-ready for the 5 enrichment columns. No need to re-enrich.
- For `rank > 5000` (8,156 rows) and `rank IS NULL` (10,580 rows), defer enrichment until either (a) a user-text/vocab-set actually needs them, or (b) the Korean-centric option K sprint subsumes them with NCIC/CSAT/TOEIC metadata.
- The pipeline scripts (`scripts/dict-fill/01-export-job.ts` `02-validate-output.mjs` `03-import-enriched.ts` + the `dict-enrich` slash command) are idempotent; re-running them does no harm but wastes API spend.
- Known gap: `packages/wlp/src/qa/rules.ts` IRREGULAR_FORMS is missing "strike → struck" (and possibly others). Small fix for a future PR; agent self-corrected by using base form during this sprint.

**Cost realized:** ~\$142 (Opus 4.7) across 58 chunks.

See [[project-vcb-cast2000-published]] for the earlier VCB cycle this builds on, and [[project-vcb-pr-stack]] for the merge-order constraint that affects PR #16's path to main.

