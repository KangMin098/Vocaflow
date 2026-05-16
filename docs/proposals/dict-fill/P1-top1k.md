# Phase 1 — Top 1K NGSL 미터치 batch

**의존:** MASTER.md
**대상:** **617 단어** (frequency_rank ≤ 1000 AND example_en IS NULL) — dry-run 2026-05-17 검증
**모델:** Opus 4.7
**비용:** ~$31
**시간:** ~40분 (병렬 5)
**청크:** 13 × 50 단어

---

## 1. 입력 생성

```bash
tsx scripts/dict-fill/01-export-job.ts --tier top1k --chunk-size 50
```

산출:
- `exports/dict-fill/p1-input-NNofMM.jsonl` (50 단어/청크, 약 13 청크)
- `exports/dict-fill/p1-manifest.json` (청크 목록 + 단어 수)

dry-run 확인:
```bash
tsx scripts/dict-fill/01-export-job.ts --tier top1k --chunk-size 50 --dry-run
# 매칭 단어 수 + 청크 분할 결과만 출력, 파일 생성 안 함
```

---

## 2. Enrichment fan-out

### 단일 청크 (smoke test 권장)
```
/dict-enrich exports/dict-fill/p1-input-01of13.jsonl
```
→ `exports/dict-fill/p1-output-01of13.jsonl`

검증:
```bash
node scripts/dict-fill/02-validate-output.mjs exports/dict-fill/p1-output-01of13.jsonl
```

샘플 5 단어 인간 검수 (output 의 example_en/ipa/synonyms 확인).

### 전체 fan-out (claude code Agent + general-purpose 또는 dict-enrich slash 반복)

병렬 5 wave 권장. 한 메시지에 5 청크 동시 호출:

```
/dict-enrich exports/dict-fill/p1-input-02of13.jsonl
/dict-enrich exports/dict-fill/p1-input-03of13.jsonl
/dict-enrich exports/dict-fill/p1-input-04of13.jsonl
/dict-enrich exports/dict-fill/p1-input-05of13.jsonl
/dict-enrich exports/dict-fill/p1-input-06of13.jsonl
```

다음 wave (07~13):
```
/dict-enrich exports/dict-fill/p1-input-07of13.jsonl
... (07~13)
```

---

## 3. 검증

각 청크별:
```bash
node scripts/dict-fill/02-validate-output.mjs exports/dict-fill/p1-output-NNofMM.jsonl
```

검증 항목:
- 입력 라인 수 = 출력 라인 수
- ok=false 비율 < 5%
- 모든 ok=true 라인이 5 필드 (example_en, synonyms, antonyms, ipa, collocations) 갖춤
- example_en 에 word 또는 inflection 포함 (R3 룰 적용)

전체:
```bash
node scripts/dict-fill/02-validate-output.mjs exports/dict-fill/p1-output-*.jsonl
```

---

## 4. Import

```bash
tsx scripts/dict-fill/03-import-enriched.ts --tier p1 --dry-run
# 매칭 단어 수 + 컬럼별 update 카운트 표시

tsx scripts/dict-fill/03-import-enriched.ts --tier p1 --apply
```

`IS NULL` 가드 → 재실행 안전.

---

## 5. 검증 SQL (Phase 1 완료 후)

```sql
-- Top 1K 범위 채움도
SELECT
  count(*) AS total,
  count(example_en) AS has_example,
  count(*) FILTER (WHERE array_length(synonyms, 1) > 0) AS has_synonyms,
  count(*) FILTER (WHERE array_length(antonyms, 1) > 0) AS has_antonyms,
  count(ipa) AS has_ipa,
  count(*) FILTER (WHERE array_length(collocations, 1) > 0) AS has_collocations
FROM public.shared_dictionary
WHERE frequency_rank IS NOT NULL AND frequency_rank <= 1000;
```

기대 (Top 1K 약 1,000 row 중):
- has_example ≥ 950 (95%)
- has_ipa ≥ 950
- has_synonyms ≥ 800
- has_collocations ≥ 800
- has_antonyms ≥ 500

---

## 6. Abort 조건

- 청크 1 smoke test 출력 품질 미달 (5/5 단어 중 ok=false ≥ 2)
- ok=false 비율 청크당 ≥ 20%
- example_en 의 word 포함 누락 ≥ 10%

→ 즉시 중단, prompt 또는 모델 검토.

---

## 7. 완료 기준

- [ ] 청크 13/13 처리 완료
- [ ] 검증 통과 (모든 청크 ok=true 비율 ≥ 95%)
- [ ] Import dry-run + apply 완료
- [ ] 검증 SQL: Top 1K 범위 has_example ≥ 95%
- [ ] 인간 sample 30 단어 검수 통과

---

## 8. 다음 Phase

P1 완료 → P2 (Top 1K~5K) 진입. 동일 흐름, 단어 수 4배.
