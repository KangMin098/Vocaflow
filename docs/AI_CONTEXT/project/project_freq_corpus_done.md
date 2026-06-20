> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_freq_corpus_done.md
> category: project

---

External word-family frequency corpus (25,002 lemma families, 25 bands "1k"…"25k") integrated into `shared_dictionary` on 2026-05-18. **Vendor name explicitly suppressed everywhere** (code/migration/DB/commit/docs) per user directive — refer to it only as "external corpus" or by the source key `freq_external_a`.

**Schema (migration `supabase/migrations/20260517235907_freq_corpus_columns.sql`):**
- `frequency_sources` jsonb (default `{}`) — multi-source rank/band map: existing NGSL backfilled to key `ngsl_1.2`, external corpus stored under key `freq_external_a`
- `frequency_band` text + CHECK ∈ {top1k, top2k, top3k, top5k, top10k, top15k, top20k, top25k, beyond_25k, phrase, compound, rare}
- `lemma_band` text + CHECK `^[0-9]+k$`
- `inflections` jsonb (default `{}`) — `{ forms: [{form, freq}, ...], source: 'freq_external_a' }`
- 4 indexes: 2 btree on the bands, 2 GIN on the jsonb cols
- `source_attributions` jsonb **NOT added** — handoff doc proposed it for vendor-string attribution; dropped to honor neutrality directive

**Why:**
- Multi-source frequency cross-validation (NGSL + external)
- Lemma-family inflections → Library/ScriptQuiz can resolve activated forms back to lemma key
- Unified `frequency_band` covers 100% of rows (including non-NGSL / null_freq), so single facet drives priority sorting

**How to apply:**
- Query priority: `WHERE frequency_band IN ('top1k', 'top2k', ...)` is now the canonical learner-priority filter
- Lemma normalization on text-extraction: probe `inflections.forms[].form` then look up the lemma row
- Stub rows (`pos='unknown'`, `source='imported'`, freq metadata only — no meaning_ko/example_en/cefr) are 15,714 newly INSERTed words; UI filtering should treat them as low-confidence until a future POS-tagging sprint enriches them
- Existing 12,182 NGSL rows now have **both** `ngsl_1.2` and `freq_external_a` keys in `frequency_sources` (7,975 rows have both; 4,207 have only NGSL because external corpus didn't include them)

**Distribution after integration (38,476 total):**
- top1k 1,285 / top2k 1,000 / top3k 1,455 / top5k 2,343 / top10k 5,834 / top15k 4,999 / top20k 6,329 / top25k 5,964 / compound 997 / phrase 5,534 / rare 2,736

**Naming conventions to honor in future code:**
- Source key in `frequency_sources` jsonb: `freq_external_a` (user-approved literal — do not change)
- Folder: `scripts/freq-corpus/` and `data/freq-corpus/`
- All large data artifacts (.xlsx, .jsonl, .txt report) gitignored — only `match_summary.json` (band counts) committed

**Cost realized:** $0 (no LLM calls — pure import).

See [[project-dict-fill-p3-done]] for the prior dict-fill sprint and [[project-dict-fill-top5k-done]] for the original Top 5K baseline.

