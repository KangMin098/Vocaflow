> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_dict_fill_p3_done.md
> category: project

---

The dict-fill P3 sprint ran to completion on 2026-05-17, immediately after P1+P2. Covered `shared_dictionary` rows with `frequency_rank > 5000` (8,105 candidate rows). After P3, the `rank>5000 AND rank IS NOT NULL` subset is enriched on the same 5 columns as P1+P2.

**Result:**
- 163 chunks × ~50 lemmas, parallel Wave size 5 (32 waves over multiple plan-limit resets)
- 8,104 / 8,105 OK (1 skipped: "bitch" — profanity guard)
- DB import: 8,104 rows UPDATEd, 0 errors
- Per-column: example_en 100%, ipa 100%, collocations 99.96%, synonyms 87%, antonyms 43%
- Quality: 2 self-fixes mid-flight (`vie/vying` lemma form, `trucker`/`blindside` R8 self-syn, `idol`/`geologist` IPA closing slash, `strike→struck` irregular)

**How to apply:**
- Treat `rank>5000 AND IS NOT NULL` subset (8,105 rows) as production-ready for the 5 enrichment columns alongside the earlier Top 5K subset
- Combined with P1+P2: NGSL-ranked rows are now fully filled across 12,131 lemmas (rank ≤ 25000 effectively)
- Remaining deferred bucket: `frequency_rank IS NULL` (10,580 rows) — idioms / non-NGSL words / phrases
- POS-mismatched VCB lemmas (492) still deferred to polysemy sprint
- Korean-centric columns (NCIC/CSAT/Konglish) still deferred to option K

**Cost realized:** ~$405 (Opus 4.7) across 163 chunks.

See [[project-dict-fill-top5k-done]] for the earlier P1+P2 phases this builds on, and [[project-freq-corpus-done]] for the subsequent multi-source frequency integration that builds on the same dict.

