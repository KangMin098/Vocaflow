# Handoff — P6 구독 시점 user V-level 필터 (C6)

> 대상: Project (claude.ai) — spec 검토/설계/실행 지시문 작성
> 실행: Claude Code (VS Code) 단독 (handoff §전역 한몸 한계 §5 — DB/migration 적용)
> 선행: handoff "학습 단어 추출 파이프라인 사전db 목적 최적합 고도화" P0~P4 완료 (PR #24 merged)
> SSoT 참조: `docs/LIBRARY_PIPELINE.md` · `docs/DB_SCHEMA.md` · `docs/LEARNING_MODEL.md` · `docs/AI_CONTEXT/diagnostics/extraction_p0_20260620.md` · `docs/AI_CONTEXT/project/project_vrl_phase2d3_track_based_recommendations.md` · `docs/AI_CONTEXT/project/project_phase3a_l2_inflections_done.md`

---

## 배경 (C6 root)

P0 단계에서 `_enroll_book_subscribe_word_sets(p_user_id, p_book_id)` 본문 정찰 — **user V-level 필터 0**.

```sql
-- 현재 본문 (요약):
INSERT user_word_set_subscriptions (user_id, set_id)
SELECT user_id, sws.id
FROM shared_word_sets sws
WHERE sws.is_published = true
  AND sws.category = 'library_book'
  AND sws.curation_query->>'book_id' = p_book_id::text;
-- → 책 구독 시 챕터 단어장 전체 구독 (V-level 필터 0)

INSERT vocabularies (...)
SELECT ... FROM shared_words sw JOIN shared_word_sets sws ON ...
WHERE 동일 조건;
-- → 사용자의 V-level / 학습 진도 / 이미 stable 단어 무관하게 일괄 import
```

**문제**:
1. V-level 5 사용자가 V9 책 enroll 시 → V6~V11 단어 모두 vocabularies import → 너무 어려운 단어 압도
2. 사용자가 이미 stable 한 단어 (예: cardinal 을 다른 책에서 이미 학습) → 중복 import → "이미 아는 단어 또"
3. 챕터당 cap=40 (P3) 이 적용된 후에도 책당 챕터 수가 많으면 세션 30~50 초과
4. → Desirable Difficulty (Bjork) / i+1 (Krashen) / Cold·Warm·Hot Layer 3 모두 위배

handoff §P6 명시:
> 발행 단어장(전역 후보)은 유지하되, subscribe_* / extract_vocabulary_for_user 가 구독 시점에 user V-level i+1 필터 + 사용자 stable 단어 dedup + 세션 30~50 cap 적용.

---

## 전역 규약 (handoff "추출 파이프라인" §전역 동일)

1. **모델**: Opus + xhigh effort 유지.
2. **마이그레이션 승인 게이트**: SQL 전문 사용자 제시 → 승인 후 `apply_migration`.
3. **shared_dictionary 보호**: 본 Phase 는 `shared_dictionary` 변경 0 (read-only).
4. **금지 컬럼**: `memory_state`/`mastery_progress`/`last_days`/`next_days` 저장 금지 (R(t) 실시간).
5. **vendor 중립화**: 함수/컬럼/주석에 vendor 실명 금지.
6. **git**: working branch 만, main 직접 push 금지, force push 금지, `--no-verify` 금지.
7. **정찰 규율**: `pg_get_functiondef` 본문 dump 필수, 이름으로 추정 금지.
8. **멱등·롤백**: `CREATE OR REPLACE` + `docs/AI_CONTEXT/rollback/P6_*_원본.sql` 저장.

### 공통 ABORT 조건

- 본문이 본 문서 가정과 구조적으로 다름 → 중단, 보고 후 재지시 대기
- 변경이 `shared_dictionary` 수정 필요 → 본 Phase 범위 외, 중단
- 검증에서 기존 사용자 학습 vocabularies row 손실 → 즉시 롤백

---

## P6.0 — 진단 (READ-ONLY) ★ 선행 필수

### 단계

- [ ] **0-1. `_enroll_book_subscribe_word_sets` 본문 dump** + 롤백 baseline 저장
- [ ] **0-2. user_profiles V-level 컬럼 충전율** — 진단 미완료 사용자 비율
  ```sql
  SELECT count(*) AS total_users,
         count(current_v_level) AS has_v_level,
         round(100.0*count(current_v_level)/nullif(count(*),0),1) AS pct
  FROM user_profiles;
  ```
- [ ] **0-3. vocabularies stable 분포** — stable 단어 dedup 의 ROI 측정
  ```sql
  SELECT 
    count(*) AS total,
    count(*) FILTER (WHERE stability >= 21) AS stable_21d,
    count(*) FILTER (WHERE review_count = 0) AS not_started,
    count(*) FILTER (WHERE last_review_at > now() - interval '7 days') AS warm
  FROM vocabularies;
  ```
- [ ] **0-4. 책 enroll 빈도** — 사용자가 평균 몇 권 enroll 하는지
  ```sql
  SELECT round(avg(book_count), 1) FROM (
    SELECT user_id, count(DISTINCT (curation_query->>'book_id')) AS book_count
    FROM user_word_set_subscriptions s
    JOIN shared_word_sets ws ON ws.id = s.set_id
    WHERE ws.category='library_book' GROUP BY user_id
  ) u;
  ```
- [ ] **0-5. V-level 불일치 영향** — published 책의 V-level vs 사용자 V-level gap 분포
- [ ] **0-6. enroll_library_book 함수 본문** — 호출 chain 확인 (변경 영향 분석)
- [ ] **0-7. extract_vocabulary_for_user 함수 본문** — 이미 i+1 적용된 경우 정합 확인 (별도 path)

### 결정표 (사용자 확정 요청)

| 결정 | 항목 | Project 권장 default | 확정 |
|---|---|---|---|
| E1 | i+1 필터 범위 | `v_level BETWEEN GREATEST(N-1,1) AND LEAST(N+1,11)` (3-band Krashen) | ? |
| E2 | 진단 미완료 사용자 fallback | `current_v_level IS NULL` 시 책의 book_v_level 사용 또는 default V5 | ? |
| E3 | stable 단어 dedup 임계 | `stability >= 21` 일 (3주 이상 안정) | ? |
| E4 | 세션 cap | 책별 최대 50 단어 (모든 챕터 합산) — 추가 50/책/일 | ? |
| E5 | 다국적 fallback | `current_v_level` 0 일 때 — base V5 (가장 흔한 한국 고등학생 평균) | ? |
| E6 | book_v_level 정보로 책 추천 vs 필터 | E1 의 i+1 안에 book_v_level 들어가는 책만 enroll 허용 (UI) vs 차단 안 함 (DB) | ? |

> **E1~E4 확정 전 P6.1 이후 착수 금지.**

---

## P6.1 — `_enroll_book_subscribe_word_sets` i+1 필터 도입

### 변경

- [ ] **1-1.** 원본 dump 저장 (`docs/AI_CONTEXT/rollback/P6_enroll_subscribe_원본.sql`)
- [ ] **1-2.** 함수 signature 변경 없음 (기존 `(uuid, uuid)`).
- [ ] **1-3.** 본문에 `user_profiles.current_v_level` SELECT 추가 + i+1 필터 WHERE 절 추가:

```sql
-- AS-IS (단순화):
INSERT vocabularies (...)
SELECT ... FROM shared_words sw
JOIN shared_word_sets sws ON sws.id = sw.set_id
WHERE sws.category='library_book' AND book_id=p_book_id;

-- TO-BE:
DECLARE
  v_user_v_level smallint;
BEGIN
  SELECT current_v_level INTO v_user_v_level
  FROM user_profiles WHERE id = p_user_id;
  -- 진단 미완료 fallback (E2)
  v_user_v_level := COALESCE(v_user_v_level, 5);
  
  INSERT vocabularies (...)
  SELECT ... FROM shared_words sw
  JOIN shared_word_sets sws ON sws.id = sw.set_id
  JOIN shared_dictionary sd ON sd.word = sw.word
  WHERE sws.category='library_book' AND book_id=p_book_id
    AND sd.v_level BETWEEN GREATEST(v_user_v_level-1, 1) 
                       AND LEAST(v_user_v_level+1, 11);  -- E1 i+1
END;
```

### 검증

- V5 사용자가 Twenty years after (V9 책) enroll → vocabularies 에 V4~V6 단어만 import (V7~V11 제외)
- V9 사용자가 동일 책 enroll → V8~V10 import (V6~V7, V11 제외)
- 미진단 사용자 → V5 default → V4~V6 import

---

## P6.2 — stable 단어 dedup (E3)

### 변경

- [ ] vocabularies 에 이미 존재하는 stable 단어 (`stability >= 21`) 는 중복 import 안 함:

```sql
INSERT vocabularies (...) 
SELECT ... 
WHERE ... AND NOT EXISTS (
  SELECT 1 FROM vocabularies v
  WHERE v.user_id = p_user_id 
    AND v.word = sw.word
    AND v.stability >= 21       -- E3 stable
);
```

ON CONFLICT (user_id, word) DO NOTHING 와 다른 의미:
- ON CONFLICT = 이미 있으면 무시 (기존 row 보존)
- NOT EXISTS stable = stable 한 단어만 dedup, learning/risk 는 재import 시도 (다만 ON CONFLICT 로 결과 동일)

실제 효과: 이미 학습한 단어가 새 책 enroll 시 vocabularies 에 다시 들어와 같은 `next_review_at` 으로 reset 되는 문제 방지.

### 검증

- 같은 단어가 다른 책에서도 나오는 케이스 (예: `cardinal` Twenty years after + Decline)
- 첫 번째 책 enroll 시 cardinal import → 학습 진행 → stability=21+
- 두 번째 책 enroll 시 cardinal SKIP (dedup) → vocabularies 의 stability/review_count 보존

---

## P6.3 — 세션 cap (E4)

### 변경

- [ ] enroll 시 책당 vocabularies import row 수 제한 (예: 50)
- [ ] composite_score 순 상위 50 만 import (책 전체 sort_order ≤ 50)
- [ ] 챕터 cap=40 (P3) 와 다른 layer:
  - P3 cap=40: 챕터당 발행 단어장 size
  - P6 cap=50: 책당 사용자 vocabularies import (chapter 합산)

```sql
INSERT vocabularies (...)
SELECT ... ROW_NUMBER() OVER (ORDER BY sw.sort_order) AS rn
FROM ...
WHERE ...
  AND rn <= 50;  -- E4 책당 세션 cap
```

### 검증

- 챕터 30개 책 enroll → 챕터별 cap=40 = 1,200 단어 (이전) → 사용자 cap=50 (이후)

---

## P6.4 — extract_vocabulary_for_user 정합 (선택)

handoff §P6 의 다른 path. `/text/[id]` 의 사용자 직접 텍스트 분석 → 이미 i+1 적용 (메모리 `project_phase3a_text_new_extraction`).

- [ ] 본문 dump 후 i+1 식이 P6.1 의 식과 정합한지 확인 (drift 차단)
- [ ] 다르면 통합 (예: 헬퍼 `_subscribe_user_v_level_floor_ceil(user_id)` 신설)

---

## P6.5 — Layer 통합 (전역 vs 개인화)

handoff §P6 의 Layer 3 (Cold/Warm/Hot · Desirable Difficulty) 명시.

| Layer | 정의 | 현재 | P6 변경 |
|---|---|---|---|
| **전역 (Cold)** | shared_word_sets 발행 — 책별 챕터별 모든 학습자 공통 | ✅ P3 cap=40 적용 | 보존 |
| **개인화 (Warm)** | enroll 시 user V-level i+1 필터 + stable dedup + session cap | ❌ user 필터 0 | **P6.1 + P6.2 + P6.3** |
| **세션 (Hot)** | 학습 세션 시작 시 (FSRS due + new) | ✅ 별도 (모듈/FSRS) | 별도 |

이 분리:
- 전역 = 큐레이션 결과 SSoT (`/admin/curation`, `/library` 책 상세 페이지)
- 개인화 = enroll 결과 (vocabularies)
- 세션 = 학습 모듈 (Flashcard / WordBlitz / PairFlip / ScriptQuiz)

---

## 검증 시나리오 (P6 적용 후)

1. **V5 사용자 + V9 책 enroll**
   - 이전: V6~V11 단어 (~1,500개) vocabularies import → cognitive load 폭발
   - 이후: V4~V6 (i+1) + stable 제외 + cap=50 → 50 단어만 (학습 가능)
2. **V9 사용자 + V6 책 enroll**
   - 이전: V6~V11 단어 → 너무 쉬움 + 어려움 혼재
   - 이후: V8~V10 (i+1) + cap=50 → 학습 가치 있는 단어만
3. **두 책에 cardinal 단어 둘 다 있음**
   - 첫 책 enroll: cardinal import → 학습 (FSRS 진행)
   - 두 번째 책 enroll: cardinal stable=21+ → SKIP (dedup) → 기존 학습 보존

---

## 착수 순서

```
P6.0 (진단 read-only) → 결정 E1~E6 → P6.1 (i+1 필터)
                                  → P6.2 (stable dedup)
                                  → P6.3 (세션 cap)
                                  → P6.4 (extract 정합)
                                  → P6.5 (Layer 통합 검증)
```

**먼저 P6.0 만 실행 → 결정표 사용자 보고 → 승인 후 P6.1 착수.**

---

## 한몸 한계 (manifest §5 그대로)

- Project = spec 검토/설계/지시문 작성/측정값 분석
- Claude Code 단독 = DB query · migration 적용 · 함수 dump/수정 · git/PR

본 handoff 는 Project 가 검토/보강 후 Claude Code 에 위임.

---

*P6 handoff 작성: 2026-06-20*
*선행 PR: #24 (P0~P4 + 재발행, v06.77~82)*
