> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_extraction_pipeline_p1_p4.md
> category: project

---

# 학습 단어 추출 파이프라인 P0~P4 완료 (v06.77~82)

**2026-06-20** · PR #24 merged (33b356b) · PR #25 P6 handoff 작성 (Project 위임 중).

## 핵심 함수 현재 상태

| 함수 | 시그니처 | 핵심 |
|---|---|---|
| `select_book_chapter_vocab(uuid)` | RETURNS TABLE | 게이트 `v_level >= 6` (D1=V6 floor · 학습밴드) + composite (4축) + register exclude (archaic_literary/period_cultural/phrase_unit) |
| `select_article_vocab(uuid)` | RETURNS TABLE | book 함수 mirror — 게이트/composite 동일 (P4 단일 코어 helper 호출) |
| `_extract_composite_score(8 args)` | RETURNS numeric IMMUTABLE | **composite 식 단일 SSoT** — P4 신설. 식 변경 시 한 곳만 수정 → book/article drift 영구 차단 |
| `publish_book_word_sets(uuid, int DEFAULT 40)` | RETURNS TABLE | cap=40 발행 + curation_query.cap 기록 |
| `publish_article_word_set(uuid, int DEFAULT 40)` | RETURNS uuid | 동일 |

## composite 식 (P4 helper `_extract_composite_score`)

```
score = ROUND(
    0.40 * (rank NULL → 0, else 1/log10(rank+10))
  + 0.35 * (freq_in_unit / NULLIF(MAX(freq) OVER (PARTITION BY unit), 0))
  + 0.15 * (V6~9 → 1.0 / V10 → 0.6 / V11 → 0.4 / else 0)
  + 0.10 * (verified=true OR example_en 존재 → 1.0)
  - (skill_level=4 AND unit_v_level<6 → 0.10)
, 4)
```

가중치 합 1.0 정규화. unit = chapter (book) 또는 article 전역.

## 결정표 (D1~D5 확정, P0 진단 결과)

| ID | 항목 | 확정값 | 측정 근거 |
|---|---|---|---|
| D1 | 학습밴드 floor | **V6** | 15/18권 V6~V8 역배제 ~23K 인스턴스 |
| D2 | freq_rank 백필 선행 | **P5a 선행** | V6~V11 충전 22.7% → 64.1% |
| D3 | phrase_unit 배제 유지 | **유지** | V6~V8 phrase_unit = 0 (CSAT 영향 0) |
| D4 | cap N | **40** | max=239, p90=57, p75=32 |
| D5 | example fallback | first_sentence | V6~V11 100% 충전 |
| C6 | 구독 user 필터 | **P6 별도 handoff** | `_enroll_book_subscribe_word_sets` 본문 user level 필터 0 |

## 7 migrations (PR #24)

```
20260620030000 extraction_fixed_learnable_floor       (P1 게이트)
20260620040000 p5a_freq_rank_backfill_from_ext        (P5a 16,492 row UPDATE)
20260620050000 p2_composite_redesign                  (P2 4축)
20260620060000 p3_publish_cap40                       (P3 cap)
20260620061000 p3b_drop_old_publish_overload          (P3b overload DROP)
20260620070000 p4_unify_composite_core                (P4 helper)
20260620080000 republish_library_books_with_p1_p4     (재발행 DO 트랜잭션)
```

## P5a 백필 추적

- 마커: `frequency_sources.p5a_backfill = '2026-06-20T00:00:00Z'`
- 백업 테이블: `shared_dictionary_p5a_backup_20260620` (PK=word + NULL 보존)
- 16,492 row · V6~V11 학습밴드 · lemma_band 'XXk' → XX*1000+500

## Why
관련 [[project-vrl-v-level-pure-semantic]] V-level 정의 + [[project-phase3a-l2-inflections-done]] L1+L2 통합.
PR #24 의 P0 진단이 SSoT — `docs/AI_CONTEXT/diagnostics/extraction_p0_20260620.md`.

## How to apply
- 추출 함수 변경 시: `_extract_composite_score` 가 단일 SSoT. helper 본문만 수정 → book/article 자동 적용.
- 새 cap/floor 적용 시: `publish_*_word_set` 의 `p_cap` 파라미터 활용 (DEFAULT 40 변경하지 말고 호출 시 명시).
- 사전 데이터 (shared_dictionary) UPDATE 는 사용자 승인 필수 ([[feedback-supabase-migrations]]).
- 재발행 정책 = 옵션 B (P3 후까지 보류) → A 변종 (진도 0 환경) 적용됨. Production 다수 사용자 환경 적용 시 `_enroll_book_subscribe_word_sets` iteration 으로 확장.

관련: [[project-p6-handoff-pending]] · [[project-doc-ai-context-3folders]]

