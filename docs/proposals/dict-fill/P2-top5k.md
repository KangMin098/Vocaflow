# Phase 2 — Top 1K~5K NGSL 미터치 batch

**의존:** MASTER.md + P1 완료
**대상:** **2,221 단어** (1000 < frequency_rank ≤ 5000 AND example_en IS NULL) — dry-run 2026-05-17 검증
**모델:** Opus 4.7
**비용:** ~$111
**시간:** ~2.5시간 (병렬 5)
**청크:** 45 × 50 단어

---

## 1. 입력 생성

```bash
tsx scripts/dict-fill/01-export-job.ts --tier top5k --chunk-size 50
```

산출:
- `exports/dict-fill/p2-input-NNofMM.jsonl` (50 단어/청크, 약 45 청크)
- `exports/dict-fill/p2-manifest.json`

---

## 2. Enrichment fan-out

P1 과 동일 흐름. 청크 45개 → wave-size 5 로 9개 wave.

각 wave 한 메시지에 5 청크 동시 호출:
```
/dict-enrich exports/dict-fill/p2-input-01of45.jsonl
/dict-enrich exports/dict-fill/p2-input-02of45.jsonl
/dict-enrich exports/dict-fill/p2-input-03of45.jsonl
/dict-enrich exports/dict-fill/p2-input-04of45.jsonl
/dict-enrich exports/dict-fill/p2-input-05of45.jsonl
```

총 9 wave (시간 ~2시간).

---

## 3. 검증

```bash
node scripts/dict-fill/02-validate-output.mjs exports/dict-fill/p2-output-*.jsonl
```

P1 과 동일 검증 항목.

---

## 4. Import

```bash
tsx scripts/dict-fill/03-import-enriched.ts --tier p2 --dry-run
tsx scripts/dict-fill/03-import-enriched.ts --tier p2 --apply
```

---

## 5. 검증 SQL (Phase 2 완료 후)

```sql
-- Top 1K~5K 범위 채움도
SELECT
  count(*) AS total,
  count(example_en) AS has_example,
  count(*) FILTER (WHERE array_length(synonyms, 1) > 0) AS has_synonyms,
  count(*) FILTER (WHERE array_length(antonyms, 1) > 0) AS has_antonyms,
  count(ipa) AS has_ipa,
  count(*) FILTER (WHERE array_length(collocations, 1) > 0) AS has_collocations
FROM public.shared_dictionary
WHERE frequency_rank > 1000 AND frequency_rank <= 5000;
```

기대 (약 2,128 row 중):
- has_example ≥ 2,020 (95%)
- has_ipa ≥ 2,020
- has_synonyms ≥ 1,700
- has_collocations ≥ 1,700
- has_antonyms ≥ 1,000

---

## 6. Abort 조건

P1 과 동일.

---

## 7. 완료 기준

- [ ] 청크 45/45 처리 완료
- [ ] 검증 통과
- [ ] Import 완료
- [ ] 검증 SQL: Top 1K~5K 범위 has_example ≥ 95%
- [ ] 인간 sample 100 단어 검수 통과
- [ ] CLAUDE.md §"🗄 Supabase DB 스키마" shared_dictionary 컬럼 fillrate 갱신

---

## 8. 후속

- P3 (Top 5K+, ~8,103 단어): 별도 sprint. 사용 빈도 낮으므로 lazy enrich 권장.
- P4 (frequency NULL, ~10,303 단어): 별도 sprint. 외부 빈도 소스 필요.
- 단어장 빌드 sprint (NGSL/수능/TOEIC 등): shared_dictionary 가 sprint 후 95%+ 채움 → 빌드 효율 높음.
