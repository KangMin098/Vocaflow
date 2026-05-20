# Phase 2 사전 합의 — ETL 작성 전 확정 필요 항목

> 작성일: 2026-05-20 · 갱신: 2026-05-21
> 목적: Phase 2 (word_lexicon → shared_dictionary 머지 ETL) 작성 전 의사결정 사항 기록
> 상태: **결정 완료 — 옵션 A 채택**. 정찰 결과 orphan 121 → **66** 으로 보정됨.
> ETL 실행 패키지: `phase2-plan.md` + `supabase/migrations/20260521_140000_lexicon_phase2_backfill.sql`

## 사전 확인된 데이터 분포 (production)

### shared_words 3,487 row 의존 패턴

| 분류 | 수량 | 설명 |
|---|---|---|
| **dual_filled** | 1,487 | `lexicon_id` (word_lexicon FK) + `meaning_ko` (자체 컬럼) 둘 다 채워짐 |
| **legacy_only** | 2,000 | `lexicon_id` NULL, `meaning_ko` (자체 컬럼) 만 채워짐 |
| 합계 | 3,487 | |

→ 정합성이 이미 깨진 상태로 운영 중. Phase 2 ETL 에서 두 그룹을 다르게 처리해야 함.

### orphan 121 row — 결정 필요 핵심

dual_filled 1,487 row 중 **121개 (8.1%)** 가 `word_lexicon` 에는 존재하나 `shared_dictionary` 에는 없음. 즉:

```
shared_words.lexicon_id → word_lexicon.id (lemma 보유)
                              ↓
                          shared_dictionary.word (해당 lemma 없음 → orphan)
```

**식별 SQL**:

```sql
-- Phase 2 ETL 작성 시 첫 단계: orphan 식별
WITH dual_filled AS (
  SELECT sw.id AS shared_words_id, sw.lexicon_id, wl.lemma, sw.word, sw.meaning_ko
  FROM shared_words sw
  JOIN word_lexicon wl ON wl.id = sw.lexicon_id
  WHERE sw.lexicon_id IS NOT NULL
)
SELECT df.*, 
       CASE WHEN sd.word IS NULL THEN 'orphan' ELSE 'matched' END AS status
FROM dual_filled df
LEFT JOIN shared_dictionary sd ON sd.word = df.lemma
WHERE sd.word IS NULL  -- orphan only
ORDER BY df.lemma;
-- 예상 결과: 121 row
```

**검증 카운트 쿼리**:

```sql
SELECT 
  COUNT(*) FILTER (WHERE sd.word IS NOT NULL) AS matched,
  COUNT(*) FILTER (WHERE sd.word IS NULL) AS orphan,
  COUNT(*) AS total_dual_filled
FROM shared_words sw
JOIN word_lexicon wl ON wl.id = sw.lexicon_id
LEFT JOIN shared_dictionary sd ON sd.word = wl.lemma
WHERE sw.lexicon_id IS NOT NULL;
-- 기대값: matched 1366 / orphan 121 / total 1487
```

## Phase 2 시작 전 결정 필요한 3가지

### 결정 A — orphan 121개 처리 방침

| 옵션 | 설명 | 장점 | 단점 |
|---|---|---|---|
| **A-1: shared_dictionary 자동 INSERT** | 121개를 `INSERT INTO shared_dictionary (word, source) VALUES (lemma, 'kice-orphan-migration')` + meaning_ko 등 후속 enrich | ETL 진행 가능, 데이터 보존 | meaning_ko 없는 row 가 121개 증가 — dict-fill sprint 필요 |
| **A-2: 별도 검토 큐** | `lexicon_orphan_review` 테이블 신설 → 121개 적재 → 수동 큐레이션 → 합격 시 shared_dictionary 로 promote | 품질 관리 | 큐레이션 사람 시간 필요 (121 단어 × 수 분) |
| **A-3: shared_words 에서 lexicon_id NULL 처리** | 해당 1,487 row 중 121개를 legacy_only 로 강등 (meaning_ko 만 유지) | 즉시 가능 | word_lexicon 의 ipa / cefr_level 등 메타 정보 손실 |
| **A-4: 단어장에서 제거** | shared_words 121 row DELETE → 단어장 발행 시 제외 | 정합성 최강 | 단어 손실 — 학습자 영향 가능 |

**권장**: A-1 (즉시 INSERT, source='kice-orphan-migration' 태깅) — 가장 빠르고 데이터 보존. dict-fill sprint 에 121개 추가는 미미한 부담.

### 결정 B — legacy_only 2,000 row 처리 방침

`lexicon_id` 가 NULL 인 2,000 row 의 `meaning_ko` 자체 컬럼 데이터:

| 옵션 | 설명 |
|---|---|
| **B-1: lemma 기준 자동 매칭 시도** | `shared_words.word` → `shared_dictionary.word` 매칭 시도, 성공 시 `lemma` 컬럼 채움. 실패분 별도 큐. |
| **B-2: 강제 매칭 X, lemma NULL 유지** | Phase 2 끝나도 lemma NULL — UI 분기 (legacy 컬럼 + 신규 컬럼) 필요 |

**권장**: B-1. Phase 2 ETL 첫 단계로 lemma 자동 매칭 시도. 매칭률 보고 후 잔여분 큐.

### 결정 C — word_frequency_stats 5,421 row 이전 정밀도

| 옵션 | 설명 |
|---|---|
| **C-1: 1:1 정확 이전** | `word_frequency_stats(lexicon_id UUID)` → `lexicon_frequencies(lemma TEXT)` 변환. `lexicon_id → lemma` 매핑 100% 검증 후 INSERT. 매핑 실패 = RAISE EXCEPTION 중단 |
| **C-2: 신규 ingest 만 lexicon_frequencies, 기존은 호환 view** | word_frequency_stats 유지 + lexicon_frequencies view 가 두 출처 UNION |
| **C-3: 손실 허용 이전** | KICE metadata.years_appeared 등 JSONB 일부 손실 허용 |

**권장**: C-1. 정확도 우선. 매핑 실패 시 즉시 중단 + 수동 해결.

## ETL 작성 시 강제 검증 사항

Phase 2 ETL 스크립트에 다음 단계 필수:

```typescript
// scripts/lexicon-phase2-etl.mjs (또는 .ts)
// 1. dry-run 모드 default
// 2. orphan 식별 + 결정 A 적용
// 3. legacy_only 자동 매칭 + 결정 B 적용
// 4. word_frequency_stats → lexicon_frequencies 정밀 이전
// 5. 각 단계 끝마다 row count 비교 + 0건 손실 검증
// 6. 매핑 실패 시 RAISE EXCEPTION
```

## Phase 2 진입 차단 조건

- [ ] 결정 A 확정
- [ ] 결정 B 확정
- [ ] 결정 C 확정
- [ ] 121 orphan SQL 식별 쿼리 production 에서 실제 카운트 검증
- [ ] Phase 1 SQL 적용 완료 + 24시간 안정화
- [ ] Playwright e2e PASS

## 참고 — 안일한 판단 회피

Phase 2 작성 시 "어차피 dual-write 라 일부 누락 OK" 같은 안일한 판단이 들어갈 위험을 사전 차단. ETL 은 **데이터 손실 0 보장 + 매핑 실패 즉시 중단** 원칙으로 작성해야 함.
