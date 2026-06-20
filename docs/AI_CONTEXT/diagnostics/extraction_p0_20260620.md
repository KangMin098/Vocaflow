# 학습 단어 추출 파이프라인 P0 진단 (2026-06-20)

> Handoff (Project 작성) "학습 단어 추출 파이프라인 사전db 목적 최적합 고도화" — P0 read-only 진단 결과.
> 측정 DB: vocaflow-dev `jajenrevcbmrpaliomxv` · 2026-06-20 시점.
> P0 종료 = 결정표 확정 + 사용자 승인 → P1 착수.

---

## 0-1. 추출 함수 본문 dump 요약

5 함수 전부 dump 완료. handoff 의 가정 모두 일치 — **ABORT 사유 없음**.

### `select_book_chapter_vocab(uuid)`

```text
RETURNS: chapter_idx, word, lemma, meaning_ko, v_level, cefr_level, pos,
         example_en, word_register, frequency_rank, frequency_in_chapter,
         skill_level, composite_score, sort_order, library_book_vocabulary_id, first_sentence

게이트:  sd.v_level >= bk.book_v_level                               ← C3 root
         AND sd.classified_by IS NOT NULL
         AND sd.meaning_ko IS NOT NULL AND length > 0
         AND COALESCE(word_register, 'standard') NOT IN
             ('archaic_literary', 'period_cultural', 'phrase_unit')

composite (round 4):
  0.70 * 1/LOG(10, COALESCE(frequency_rank, 50000) + 10)           ← C2: NULL→50000 상수
  + 0.10 * (1 - 1/(COALESCE(frequency_in_chapter, 1) + 1))         ← C1: 챕터 max 정규화 없음, 평탄 압축
  + CASE WHEN skill_level=4 AND book_v_level<6 THEN -0.10 ELSE 0   ← skill penalty
  (no cap, no LIMIT)                                                ← C4 root

정렬: ROW_NUMBER() OVER (PARTITION BY chapter_idx
                         ORDER BY composite_score DESC,
                                  frequency_in_chapter DESC NULLS LAST,
                                  v_level ASC, word)
```

### `select_article_vocab(uuid)` — book 함수의 mirror

게이트만 차이: `sd.v_level >= COALESCE(article_v_level, 4)` (article fallback V4).
나머지 composite/register/order 모두 book 함수와 동일. P4 단일 코어 통합 대상.

### `publish_book_word_sets(uuid)`

- `select_book_chapter_vocab(p_book_id)` 결과 전체를 temp `_sel` 에 적재 — **LIMIT 없음**
- 챕터별 `shared_word_sets` 1행 + `shared_words` 챕터별 sort_order 순 일괄 INSERT
- **이미 존재하면 `CONTINUE`** — 재발행은 set DELETE 선행 필요
- `curation_query` JSONB 에 `{book_id, chapter_idx, filter, book_v_level, selection='v06.35 learning-optimal'}`
- **P3 cap 적용 지점**: 본 함수의 INSERT SELECT 에 `WHERE sort_order <= cap_n` 추가가 안전

### `compute_book_vrl(uuid)`

- distinct lemma 만 percentile (V11 제외) → P50/P75/P90 + weighted_avg
- `library_books.book_v_level = P75` (smallint)
- `vrl_components` JSONB (method='p75_type_v11_excluded_l1_l2_inflections')
- **변경 금지** (난이도 표시 전용 — handoff §P1 명시)

### `_enroll_book_subscribe_word_sets(uuid, uuid)`

- `shared_word_sets WHERE category='library_book' AND curation_query->>'book_id' = p_book_id` 전체 구독
- **user V-level 필터 0** → **C6 후행 분리 확정** (P6 별도 handoff 필요)

---

## 0-2. 추출 테이블 컬럼명 확정

| 테이블 | 핵심 컬럼 | placeholder 해소 |
|---|---|---|
| `library_book_vocabularies` | `id` · `library_book_id` · `chapter_idx` · `word` · `lemma` · `frequency_in_book` · `frequency_in_chapter` · `first_sentence` · `base_learning_value` | 챕터 키 = `chapter_idx`, 챕터 빈도 = `frequency_in_chapter` |
| `library_article_vocabularies` | `id` · `library_article_id` · `word` · `lemma` · `frequency_in_article` · `first_sentence` · `base_learning_value` | 글 빈도 = `frequency_in_article` |
| `shared_word_sets` | `category` · `cefr_level` · `word_count` · `is_published` · `curation_query` (jsonb) · `slug` · `version` · `auto_curated` | `category='library_book'`, `curation_query->>'book_id'` 키 |
| `shared_words` | `set_id` · `word` · `lemma` · `meaning_ko` · `example_en` · `cefr_level` · `sort_order` · `library_book_vocabulary_id` · `source_sentence` | sort_order 정렬, source_sentence = first_sentence 복사 |

**P2 salience 정규화 식 (확정 컬럼명 적용)**:
```sql
-- book 함수: 챕터 내 max 정규화
frequency_in_chapter::numeric / NULLIF(MAX(frequency_in_chapter) OVER (PARTITION BY chapter_idx), 0)
-- article 함수: 글 전체 max
frequency_in_article::numeric / NULLIF(MAX(frequency_in_article) OVER (), 0)
```

---

## 0-3. frequency_rank 충전율 — D2 판정

| scope | total | filled | pct |
|---|---:|---:|---:|
| 전체 | 45,325 | 12,181 | **26.9%** |
| V6~V11 (학습밴드) | 39,776 | 9,013 | **22.7%** |
| V6~V8 (CSAT 핵심) | 8,483 | 3,396 | 40.0% |

**결론**: V6~V11 학습밴드 22.7% << 60% threshold → **D2: P5a (frequency_rank 백필) 선행 필수**.
이는 C2 (composite NULL→50000 상수화) 의 직접 원인. P2 composite 재설계 전 P5a 부터 수행해야 의미.

---

## 0-4. V6~V8 역배제 (C3 피해 규모) — D1 근거

```
30 books · book_v_level 분포 별 V6~V8 손실:

book_v_level=9 (7권): V6~V8 100% 손실
  Les Misérables                3,477
  Dialogues                     3,431
  Decline and Fall              3,214
  Jane Eyre                     2,729
  Great Expectations            2,381
  Twenty years after            2,207
  Poetry                        1,539

book_v_level=8 (3권): V6~V8 70~85% 손실 (V6,V7 만)
  Sherlock Holmes               1,224 / 1,619
  Wind in the Willows           1,041 / 1,423
  Pride and Prejudice             954 / 1,231

book_v_level=7 (5권): V6 손실 (35~45%)
  Huckleberry Finn                329 / 918
  Railway Children                315 / 825
  Fables                          314 / 767
  Pinocchio                       301 / 704
  Just So Stories                 160 / 413

book_v_level≤6: 손실 0 (Alice, Wizard of Oz, Ammachi 등)
```

**합계**: 15/18권에서 손실. 총 ~23,000 단어 인스턴스 차단.
**결론**: **D1 = V6** (handoff default 확정). CSAT 핵심 = V6~V9. 고등학생 V≤5 = 기지어. Alice (V6) 같은 책은 floor=V6 으로 영향 없음.

---

## 0-5. 챕터당 단어 수 분포 — D4 근거

| min | max | avg | p50 | p75 | p90 | sets |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | **239** | 28.8 | 21 | 32 | 57 | 259 |

**결론**: max=239 심각한 오버. p90=57 도 cognitive load 초과. **D4 = N=40** (handoff default 확정).
- p75=32 안전권 → 75% sets 영향 없음
- p90=57, max=239 → 상위 13% 만 cap 적용
- Cognitive Load (Sweller, 작업기억 ~4 항목, 세션 30~50) 정합

---

## 0-6. 학습밴드 데이터 완전성 — D5 판정

V6~V11 (39,776 row):

| 지표 | 카운트 | % |
|---|---:|---:|
| classified_by | 39,776 | **100.0%** |
| meaning_ko | 39,776 | **100.0%** |
| example_en | 39,776 | **100.0%** |

**결론**: 완전. **D5 = first_sentence fallback 유지 OK** (P5c 백필 불요).

---

## 0-7. register 분포 + phrase_unit — D3 판정

| register | total | in_band (V6~V11) | V6~V8 (CSAT 핵심) |
|---|---:|---:|---:|
| standard | 27,843 | 22,294 | 8,481 |
| modern_advanced | 12,420 | 12,420 | 2 |
| **phrase_unit** | 4,319 | 4,319 | **0** |
| archaic_literary | 446 | 446 | 0 |
| period_cultural | 297 | 297 | 0 |

**결론**: phrase_unit V6~V8 = 0 (모두 V9~V11). 현재 phrase_unit 배제가 CSAT 핵심에 영향 없음. **D3 = phrase_unit 배제 유지** (handoff default 와 반대).

---

## 0-8. standard + C2 이상치 — P5b 판정

- standard+C2 총 9,219 (학습밴드 9,139)
- 표본 30 검토: ~13-20% 가 archaic/period 잔재 (예: `scallawags` V9 / `tierce` V11 / `plumy` V9 / `bandbox` V10 / `doctorish` V10 / `unbelief` V8) — register 재분류 후보
- 대다수 (~80%) 는 현대 고급 어휘로 C2 정합 (`hydrology` / `monism` / `circumnavigation` 등)

**결론**: 즉시 위험 아님. **P5b 후행 검토 대상** (P1 차단 사유 아님).

---

## 결정표

| ID | 항목 | 측정값 | 권장 | 사유 |
|---|---|---|---|---|
| **D1** | 고정 학습밴드 floor | 15/18권 V6~V8 역배제 ~23K 단어 | **V6** | CSAT 핵심 V6~V9 보호 · V≤5 기지어 가정 · Alice/Oz 영향 0 |
| **D2** | frequency_rank 백필 선행 | V6~V11 22.7% (< 60%) | **P5a 선행** | P2 composite 의 freq_global 항이 무의미 → 백필 후 P2 |
| **D3** | phrase_unit 배제 | V6~V8 phrase_unit = 0 | **배제 유지** | CSAT 핵심에 phrase_unit 없음. V9~V11 의 4,319 는 학습 우선순위 아님 |
| **D4** | 챕터당 cap N | max=239 / p90=57 / p75=32 / avg=28.8 | **40** | Cognitive Load 정합 · 상위 13% sets 만 영향 |
| **D5** | example_en 충분성 | V6~V11 100% | first_sentence fallback 유지 | 추가 백필 불요 |
| **C6** | 구독 시 user V-level 필터 | 본문 확인 = 필터 없음 | **P6 후행 분리** | 별도 handoff 필요 |
| P5b | standard+C2 register 재분류 | 표본 30 → ~15% 의심 | **P1 후 검토** | P1 차단 사유 아님 |

---

## P1 착수 조건 (handoff 정합)

```
✅ P0 read-only 진단 완료
⏳ 사용자 D1~D4 확정 (D1=V6 / D2=P5a선행 / D3=유지 / D4=40)
⏳ D2 = P5a 선행 → P1 전에 frequency_rank 백필 먼저 수행

권장 새 순서:
  P0(완료) → 결정 승인 → P1 (게이트 디커플, 저위험·최고효과)
                       → P5a (freq_rank 백필, 승인 필수)
                       → P2 (composite 재설계)
                       → P3 (cap 40)
                       → P4 (단일 코어 통합)
                       → P5b/P5c/P6 (후행)
```

**P1 은 P5a 와 독립** — 게이트 디커플은 C3 단독 해결로 D1 만 있으면 즉시 가능.
**P2 는 P5a 후행** 권장 — composite freq_global 의 의미 회복을 위해.

---

## 다음 단계 (사용자 결정 필요)

1. **D1~D4 확정 승인** — 위 권장값 그대로 OK?
2. **P1 즉시 착수 여부** — 게이트 디커플 (D1=V6) 만 먼저 진행, P5a 와 병렬?
3. **P6 별도 handoff 작성** — C6 (구독 user 필터) 는 본 진단 범위 외, 별도 작업 분리?
4. **published 도서 재발행 정책** — P1 적용 후 기존 단어장 (259 sets) 재발행 시 사용자 진도 처리:
   - 옵션 A: 재발행 전 진도 백업 → 새 set 으로 진도 이전
   - 옵션 B: 기존 set 보존 + 새 set 별도 발행 (version=3)
   - 옵션 C: 재발행 skip (기존 사용자만 진도 유지 + 신규 사용자만 새 set)

---

*P0 진단 종료. 결정표 승인 후 P1 착수.*
