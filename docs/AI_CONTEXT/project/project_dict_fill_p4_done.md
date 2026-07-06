> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_dict_fill_p4_done.md
> category: project

---

P4 sprint filled the 2,738 newly-INSERTed stub rows in `shared_dictionary` whose `lemma_band` falls in `1k`-`9k` (the high-frequency portion of the 15,714 stubs added by the freq-corpus sprint). Completed 2026-05-18 via Claude Code subagent batching (P3 pattern): 92 chunks × 30 lemmas, 5 parallel agents per wave, 19 waves.

**Result:**
- 2,738/2,738 OK (100% — every chunk produced full 1:1 output)
- Post-normalize validity: 2,730/2,738 = 99.7% pass (8 outliers tolerated: 3 corpus edge-case lemmas like prefixes "multi"/"sur"/"que"; 5 irregular-form stem-check false positives like wove/clung/slew/wrung — all valid data)
- DB import: 2,738 rows UPDATEd, 0 errors, 0 skipped, 0 chunk mismatches
- Fields filled per row: `pos`, `meaning_ko`, `meanings_ko` (jsonb array, polysemes 2~5 senses), `example_en`, `ipa` (/.../ form), `synonyms`, `antonyms`, `cefr_level`, `korean_learner_note`
- Side effect: `source` set to `ai-generated`, `verified` set to `false` (Top 5K human review deferred to a separate sprint)

**Why a key-mapping fix mattered:**
Some agents rewrote a headword to its lemma form (corpus headword `lasted` → output `last`). Solution: import script pairs input/output chunks line-by-line and uses INPUT.word as the DB key (not output's word field). 1:1 line alignment was preserved across all 92 chunks.

**How to apply:**
- `shared_dictionary.lemma_band IN ('1k'…'9k')` subset is now production-quality on the 9 enrichment columns
- Hub/library/script lookups can rely on meaning_ko + cefr_level + pos for those rows
- Remaining stubs: `lemma_band IN ('10k'…'25k')` = 12,976 rows still pos='unknown' / meaning_ko NULL. Treat as low-priority; lazy-enrich on demand or schedule a future sprint
- `verified=true` is reserved for human-reviewed entries — currently 12,182 (NGSL Top 5K subset, pre-existing). All AI-generated rows are `verified=false`

**Naming convention reaffirmed:**
- `freq_external_a` key in `frequency_sources` jsonb was kept anonymous per user directive — no vendor/license traces in code, DB, commit, or docs
- Scripts: `scripts/dict-fill/p4-extract-targets.ts` / `p4-enrich.ts` / `p4-normalize.mjs` / `p4-verify.ts` / `p4-verify-detail.mjs` / `p4-import-to-db.ts`
- All artifacts (chunk JSONL, output JSONL, logs) gitignored

**Cost realized:** ~$140 (Opus 4.7 via Claude Code subagent batching, same path as P1+P2+P3)

**Commit:** Scripts committed by user under `6491c46` ("feat(dict-categories): name_ko backfill infrastructure + H1/H2 hand-curated seeds — DICT-FILL P4 prior sprint scripts checked in"). No separate P4 commit needed.

**Distribution at sprint end (shared_dictionary 38,476):**
- meaning_ko filled: 25,500 (= 22,762 prior + 2,738 P4)
- meaning_ko NULL: 12,976 (= 10k~25k tier, deferred)
- pos='unknown' remaining: 12,976 (same set)
- source='ai-generated' verified=false: 3,730 (= P4 2,738 + earlier VCB cycle ~992)
- CEFR span of new P4 rows: A1=171 / A2=237 / B1=349 / B2=1,239 / C1=1,547 / C2=187 (mostly B2~C1 as expected for 1k~9k band tail)

**후속 (2026-07-06, "Tier B/C ~5.1K" 백로그 종결)**: 실측 재진단 결과 rank 보유 구간(A~C 28,673)은 example 100%·ipa 96%+로 건강 — 미보강 코어는 rank NULL 16,823. 그중 **발행 세트 노출 331단어만 표적 보강**(ipa 77→1·syn 142→48·coll 278→20·example→0, 잔여는 대명사/약어/희귀어 등 본질상 무동의어). 나머지: B/C collocations 16,001·세트밖 노출 4,652 = 보류, 비노출 ~10.8K = 종결. **✅ 스텁 예문 7,143건 전량 종결 (2026-07-06 저녁)**: 노출 47 + 근접 노출(published/ready 도서 어휘) 201 = 248건 정상 예문 교체 · 잔여 비노출 6,894건 `example_en=NULL`(깨진 문장보다 공란이 정직 — 향후 노출 시 lazy-enrich). 전수 스캔 스텁 잔존 0. example NULL 171→7,065(착시 제거된 실상). ⚠️ 인프라 교훈: MCP 프록시 502 장기 장애 시 서비스롤 supabase-js 폴백; PostgREST LIKE 전표 스캔은 timeout → **PK 범위 페이지네이션+클라 필터**로 우회.

See [[project-dict-fill-p3-done]] for the prior NGSL-rank sprint, [[project-freq-corpus-done]] for the corpus that created these stubs, and [[project-dict-fill-top5k-done]] for the original Top 5K baseline.

