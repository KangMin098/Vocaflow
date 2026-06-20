> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_library_books_v_level_poc.md
> category: project

---

# Library Books V-Level Centroid PoC (2026-05-25)

## 적용 방식

```sql
WITH levels AS (
  SELECT b.id, sd.v_level::int AS vl, bv.frequency_in_book
  FROM library_books b
  JOIN library_book_vocabularies bv ON bv.library_book_id = b.id
  JOIN shared_dictionary sd ON sd.word = bv.lemma
  WHERE bv.lemma IS NOT NULL AND sd.v_level IS NOT NULL AND sd.v_level < 11
)
SELECT percentile_disc(0.75) WITHIN GROUP (ORDER BY vl) AS book_v_level
FROM levels GROUP BY id;
```

## 5권 PoC 결과 (V11 archaic 제외)

| 도서 | CEFR | matched lemma | P50 | P75 | P90 | freq-weighted |
|---|---|---|---|---|---|---|
| Alice's Adventures (Carroll) | C1 | 1,602 | 4 | **6** | 9 | 3.60 |
| Frankenstein (Shelley) | B2 | 3,762 | 6 | **8** | 9 | 4.81 |
| Dorian Gray (Wilde) | B2 | 3,707 | 5 | **8** | 9 | 4.52 |
| Sherlock Holmes (Doyle) | C1 | 4,501 | 6 | **8** | 9 | 4.54 |
| Pride and Prejudice (Austen) | C1 | 3,354 | 5 | **8** | 9 | 4.47 |

검증 신호:
- 동화 (Alice) P75=V6 vs 고전 4권 P75=V8 — 합리적 분리
- weighted_avg (frequency-weighted) 3.60~4.81 — 본문 중심 단어는 낮은 V-Level
- 모든 도서 P90=V9 — 희귀어 빈도 분포 정합

## 잔존

- 6번째 도서 (어휘 추출 없음) book_v_level 계산 불가
- lemma NULL 4,627 row (22,276 중 21%) — 빈도 외부 corpus inflection JOIN 으로 보강 가능 (Phase 3B)
- vrl_components JSONB · book_vrl_score · lexile_measure 미산정 (Phase 3B 통합 분류)

## 컬럼 매핑

`library_books` 에는 이미 다음 컬럼 존재:
- `book_v_level smallint` (P75 centroid 적용 대상)
- `book_vrl_score integer` (Phase 3B 종합 점수)
- `lexile_measure integer` / `lexile_source text`
- `vrl_components jsonb` (P50/P75/P90/weighted 다 저장)
- `vrl_calculated_at timestamptz`

