# Phase 2 ETL 실행 패키지 — 계획서

> ADR Lexicon Unification v3.1 Phase 2 — Data Backfill
> 작성일: 2026-05-21
> 상태: **계획서 단계 — SQL 적용 보류**. 24시간 모니터링 통과 + Step 4 source CHECK 사전 확인 후 Dashboard 수동 실행.

## 사전 결정 사항

| 결정 | 선택 | 근거 |
|---|---|---|
| orphan 처리 | **옵션 A** — `shared_dictionary` INSERT, `source='kice-orphan'` | 정찰 결과 orphan 66 row (당초 121 추정에서 보정). Phase 4 빠른 진행 + 추적 가능 source 태깅 |
| 실행 시점 | **24h 모니터링 통과 후 + P5 enrichment 100% 완료 후** | Phase 1 안정성 + 데이터 품질 보호 |
| 실행 방식 | **Dashboard 수동 SQL Editor** | 메모리 제약 — auto-apply 금지 |

## ⚠ P5 enrichment 충돌 — 실행 전제 (강제)

P5 (`scripts/dict-fill/p5-*`) 는 `shared_dictionary` 의 `meaning_ko` / `meanings_ko` / `ipa` / `cefr_level` 등을 LLM 으로 채우는 작업. Phase 2 Step 2 는 `meanings_ko → senses` JSONB 변환.

**P5 미완 상태에서 Phase 2 실행 시 위험:**

1. **Race condition** — P5 가 채운 신규 `meanings_ko` 가 Phase 2 변환 직후 도착 → senses JSONB 와 meanings_ko 불일치 (Phase 2 는 시점 스냅샷 변환)
2. **Step 2-C 데이터 품질 손실** — Step 2-C 는 `meanings_ko IS NULL AND meaning_ko IS NOT NULL` row 를 *meaning_ko 텍스트 한 줄만* 으로 빈약한 단일 sense 생성. 해당 row 가 사실 *P5 작업 대상* (다의어/예문/register 등 풍부화 예정) 이라면, Phase 2 가 먼저 빈약 sense 를 박아 넣고 P5 결과가 sense 구조에 반영되지 못함.
3. **Step 5 보강 race** — P5 가 shared_dictionary 의 `ipa` / `cefr_level` 을 채우는 동안 Phase 2 Step 5 가 word_lexicon 값으로 COALESCE 채우면 어느 값이 최종인지 불분명.

**원칙**: **P5 enrichment 100% 완료 후에만 Phase 2 실행**. P5 진행 중 실행 금지.

**적용 전 확인 SQL**:
```sql
-- P5 작업 큐 잔여 0 확인 (P5 정의 따라 쿼리 조정 필요)
SELECT
  -- meaning_ko 가 있으나 meanings_ko 가 비어있는 row — P5 backfill 대기군
  (SELECT COUNT(*) FROM shared_dictionary
   WHERE meaning_ko IS NOT NULL AND (meanings_ko IS NULL OR jsonb_array_length(meanings_ko) = 0)) AS p5_pending_meanings,
  -- ipa 미채움
  (SELECT COUNT(*) FROM shared_dictionary WHERE ipa IS NULL) AS p5_pending_ipa,
  -- cefr_level 미채움
  (SELECT COUNT(*) FROM shared_dictionary WHERE cefr_level IS NULL) AS p5_pending_cefr;
```

위 카운트가 P5 완료 시점 기대값에 도달 시에만 Phase 2 진행. P5 책임자(또는 P5 실행 스크립트 종료 로그) 의 100% 완료 신호 확인 필수.

## 영향 범위 (정찰 카운트)

| Step | 작업 | 영향 row |
|---|---|---:|
| 1 | primary_pos 채움 (`NULLIF(pos, 'unknown')`) | 38,476 |
| 2-A | legacy meanings_ko 패턴 변환 | 24,382 |
| 2-B | 신규 패턴 sense_idx 추가 | 1,118 |
| 2-C | NULL meanings_ko → 단일 sense | 12,976 |
| 3 | pos_set 자동 추출 | ≥ 25,000 |
| 4 | orphan 66 INSERT (`source='kice-orphan'`) | 66 |
| 5 | word_lexicon 비-orphan 보강 (`COALESCE`) | 3,701 |
| 6 | `word_frequency_stats → lexicon_frequencies` | 5,421 |
| 7-A | `csat-prep-core-2k` list_tag | 1,904 |
| 7-B | `csat-prep-ext-1.8k` list_tag | 1,303 |
| 7-C/D | lexicon_frequencies INSERT (시중 단어장) | 3,207 |
| 8 | shared_words / vocabularies / library_* lemma 채움 | ~ 다수 |
| **총** | | **~89,000 row** |

## 검토 사항 4건 (적용 전 확인)

| # | 항목 | 결정 |
|---|---|---|
| 1 | `shared_dictionary.source` CHECK 제약 → `'kice-orphan'` 차단 여부 | **사전 SQL 점검 필요**. 차단 시 `'imported'` + metadata JSONB 폴백 |
| 2 | Step 2-A 청크 루프 가독성 (이중 종료 조건) | 동작 정상. 차후 정리 권장 (`LIMIT` 단독으로 충분) |
| 3 | Step 5 갱신 row 카운트 | `GET DIAGNOSTICS ROW_COUNT` 적용 완료 |
| 4 | 롤백 한계 | Step 5 보강(cefr/ipa) NULL→값 갱신은 원본 미보존 → 백업 의존 명시 |

## 실행 절차 (24h 통과 후)

1. **사전 점검** — `pg_constraint` 에서 `shared_dictionary.source` CHECK 제약 확인:
   ```sql
   SELECT conname, pg_get_constraintdef(oid)
   FROM pg_constraint
   WHERE conrelid='public.shared_dictionary'::regclass AND contype='c';
   ```
2. **Supabase Dashboard 백업** (Manual backup, ~30초)
3. **선결 조건 5건 검증** — Phase 1 적용 + 24h + freeze trigger + 데이터 보존 + 신규 컬럼
4. **SQL 적용** — `supabase/migrations/20260521_140000_lexicon_phase2_backfill.sql` Dashboard SQL Editor 붙여넣기 → Run
5. **NOTICE 검증** — 8단계 통과 NOTICE 모두 출력 + 최종 검증 통과
6. **KPI 비교** — `baseline-query.sql` post-phase-2 변형 실행, `docs/proposals/lexicon-unification/post-phase2-kpi.json` 저장
7. **e2e 회귀 비교** — Playwright 재실행 → `baseline-pre-phase3.json` 저장 → `baseline-pre-phase2` 와 동일 패턴 (5/2/0) 확인
8. **24h 모니터링** — 매시간 헬스 체크 + 사용자 클레임 0건

## Phase 3 진입 조건

- [ ] **Phase 2 실행 전 P5 enrichment 100% 완료 확인** (위 SQL)
- [ ] senses 채움 ≥ 30,000
- [ ] orphan 정확히 66 INSERT (source='kice-orphan')
- [ ] lexicon_frequencies ≥ 8,500
- [ ] shared_words.lemma 채움률 ≥ 95%
- [ ] baseline-pre-phase3 == baseline-pre-phase2 패턴 (5/2/0)
- [ ] API 응답시간 +20% 이내
- [ ] 사용자 클레임 0건

## 참고 파일

- 마이그레이션 SQL: `supabase/migrations/20260521_140000_lexicon_phase2_backfill.sql`
- Phase 2 사전 합의: `docs/proposals/lexicon-unification/phase2-prerequisites.md`
- 회귀 비교 기준: `docs/proposals/lexicon-unification/baseline-pre-phase2.json` + `-meta.md`
