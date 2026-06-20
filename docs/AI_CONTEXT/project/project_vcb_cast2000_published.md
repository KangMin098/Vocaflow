> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vcb_cast2000_published.md
> category: project

---

VCB run_id=1 (slug `cast-2000`, 2,000 lemmas) was carried fully through Steps 1–8 in May 2026 and is now `status=published`. shared_word_sets has one row (id `977dd90e-2b59-47c6-a187-254a24b2c4f7`, v1, category `high`) with 2,000 shared_words.

**Why:** First end-to-end validation of the VCB pipeline + first concrete data input to learning modules. Subsequent runs (e.g. csat-2000) reuse the same flow without re-debugging.

**How to apply:** When working on VCB scripts or schemas, assume run_id=1 is your reference dataset. shared_dictionary fillrates (post-cast-2000): example_en / synonyms / ipa / collocations / register ≈ 6.6%; korean_learner_note ≈ 4.5%; antonyms ≈ 4.4% — out of 22,762 total rows. The remaining ~21K rows are planned via 11 more VCB seed runs (see [[project-vcb-dictopt-sprint-plan]]).

**Key tooling added this run (do not re-invent):**
- `scripts/vcb/07b-bulk-approve.mjs` — bulk curator approve for a whole run, idempotent
- `scripts/vcb/05e-promote-to-dictionary.mjs` — copy enriched_payload → shared_dictionary on matching (word, pos); POS lowercase mapping NOUN→noun etc.
- `scripts/vcb/99-cefr-relabel.mjs` — realigns cefr_level with NGSL_RANK_CEFR_EXPECTATIONS (closest-acceptable rule)
- `packages/vcb-curate-core/src/publish.ts` `fetchPublishableItems` — paginated past PostgREST 1000-row cap

**Open known issue:** ~10,580 of the 12,990 remaining C2 rows have `frequency_rank=NULL` (not in NGSL), so 99-cefr-relabel can't touch them. C2 still dominates the distribution (57%) for that reason — needs AI-side reclassification or external frequency signal, not a SQL rule.

