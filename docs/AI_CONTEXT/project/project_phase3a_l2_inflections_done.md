> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_phase3a_l2_inflections_done.md
> category: project

---

# Phase 3A — L2 inflections 적용 완료 (2026-05-25)

## 적용 마이그레이션 3종

1. `inflections_gin_index` — `idx_shared_dictionary_inflections_gin` (jsonb_path_ops)
2. `extract_vocabulary_for_user_v2` — L1+L2 통합 + match_layer/matched_via_surface 컬럼 2개 추가
3. `find_unmatched_lemmas(text[])` — 미매칭 lemma 추적용 보조 RPC

## 실측 회수율 (Gatsby 1장 80 lemma PoC)

| Layer | 매칭 | 누적 |
|---|---|---|
| L1 (`word = lemma`) | 72/80 | 90.00% |
| L2 (`inflections.forms[*].form` jsonpath) | +7/80 | **98.75%** |
| Unmatched | 1/80 (`plagiaristic`) | 1.25% |

성능: GIN 인덱스 사용 시 L2 jsonpath 매칭 **2.7ms** (Bitmap Index Scan 확인).

## v1 vs v2 호환성

v1 (`extract_vocabulary_for_user`) **그대로 보존**. v2 신규 함수로 점진 전환. 반환 컬럼 18→20 (match_layer + matched_via_surface 추가). 모든 helper 로직 inline 으로 v1 과 동일 (gaussian σ²=2.25, weights 0.50/0.25/0.15, penalty -0.10/-0.20/-0.50).

## inflections JSONB 구조 정합 (실측)

```json
{"forms": [{"form": "run", "freq": 23795}, ...], "source": "freq_external_a"}
```

올바른 jsonpath: `$.forms[*].form ? (@ == "running")` — `$.*` 형식은 잘못됨.

## 후속 무용 사항

- `lemma_normalized` 컬럼 신설 **불필요** — `word` 가 이미 정규화된 lemma (3건 예외만)
- 4-Tier Fallback Score 시스템 **불필요** — classified_by 100% 채움 확정 (Round 10 완료)
- 5-Layer Pipeline 설계 **불필요** — L3 surface fallback 은 L1 과 동일 효과

