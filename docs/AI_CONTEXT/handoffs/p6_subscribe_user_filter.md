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

## P6.0 — 진단 (READ-ONLY) ★ 선행 필수 · 게이트

> **게이트 엄격 적용**: P6.0 (read-only) + 아래 2 binary 확인 → **Project 측에 보고 → 사용자 승인 → P6.1 착수**.
> Code 가 P6.0 단독 실행 후 자동으로 P6.1 진입 금지.

### 단계

- [ ] **0-1. `_enroll_book_subscribe_word_sets` 본문 dump** + 롤백 baseline 저장 (`docs/AI_CONTEXT/rollback/P6_enroll_subscribe_원본.sql`)
  - 🔴 **P6.1 설계 blocker** — INSERT 절 + ON CONFLICT 본문 그대로 보고 (i+1 필터 삽입 위치 결정 근거)
- [ ] **0-2. user_profiles V-level 컬럼 충전율** — 진단 미완료 사용자 비율
  ```sql
  SELECT count(*) AS total_users,
         count(current_v_level) AS has_v_level,
         round(100.0*count(current_v_level)/nullif(count(*),0),1) AS pct
  FROM user_profiles;
  ```
- [ ] **0-3. vocabularies stable 분포** — stable 단어 dedup ROI
  ```sql
  SELECT
    count(*) AS total,
    count(*) FILTER (WHERE stability >= 21) AS stable_21d,
    count(*) FILTER (WHERE review_count = 0) AS not_started,
    count(*) FILTER (WHERE last_review_at > now() - interval '7 days') AS warm
  FROM vocabularies;
  ```
- [ ] **0-4. avg 책/user** (E4 cap 산정 기반)
  ```sql
  SELECT round(avg(book_count), 1) AS avg_books_per_user,
         min(book_count) AS min_b,
         max(book_count) AS max_b,
         percentile_disc(0.9) WITHIN GROUP (ORDER BY book_count) AS p90_b
  FROM (
    SELECT user_id, count(DISTINCT (ws.curation_query->>'book_id')) AS book_count
    FROM user_word_set_subscriptions s
    JOIN shared_word_sets ws ON ws.id = s.set_id
    WHERE ws.category='library_book' GROUP BY user_id
  ) u;
  ```
- [ ] **0-5. V-level gap 분포** — published 책 vs 사용자 (E2 fallback 결정 근거)
  ```sql
  -- gap = user.current_v_level − books.book_v_level
  SELECT
    GREATEST(LEAST(u.current_v_level - b.book_v_level, 3), -3) AS gap_bucket,
    -- bucket 범위: [-3, +3], 이외는 clamp
    count(*) AS pairs
  FROM user_profiles u
  CROSS JOIN library_books b
  WHERE u.current_v_level IS NOT NULL
    AND b.book_v_level IS NOT NULL
    AND b.status='published'
  GROUP BY 1 ORDER BY 1;
  -- gap > 0 = 사용자 책보다 낮음 / gap < 0 = 사용자 책보다 높음
  -- bucket 외 (실 |gap| >= 4) 카운트도 별도 보고
  ```
- [ ] **0-6. enroll_library_book 함수 본문** — 호출 chain (변경 영향 분석)
- [ ] **0-7. extract_vocabulary_for_user 함수 본문** — 이미 i+1 적용 path 정합
- [ ] **0-8.** (선택 — P6.6 소급 ROI) 기존 vocabularies 의 i+1 위반 / stable-dup row 수
  ```sql
  -- 사용자별 i+1 위반 카운트 (vocab v_level 이 user current ± 1 범위 외)
  SELECT u.id, u.current_v_level,
    count(*) FILTER (
      WHERE sd.v_level NOT BETWEEN GREATEST(u.current_v_level-1, 1) AND LEAST(u.current_v_level+1, 11)
    ) AS i_plus_1_violations,
    count(*) FILTER (WHERE v.stability >= 21) AS already_stable
  FROM user_profiles u
  JOIN vocabularies v ON v.user_id = u.id
  JOIN shared_dictionary sd ON sd.word = v.word
  WHERE u.current_v_level IS NOT NULL
  GROUP BY u.id, u.current_v_level
  ORDER BY i_plus_1_violations DESC LIMIT 10;
  -- P6.6 소급 규모 산정 — F1/F2/F3 옵션 선택 근거
  ```

### 🔒 2 Binary 확인 (Project 보고 필수)

다음 두 결과는 P6.1 의 식 구조를 결정 — Project 가 명시 받지 못하면 spec 보강 불가.

- [ ] **B1. `UNIQUE(user_id, word)` 제약 존재 여부**
  ```sql
  SELECT conname, contype, pg_get_constraintdef(oid) AS def
  FROM pg_constraint
  WHERE conrelid = 'vocabularies'::regclass
    AND (contype = 'u' OR contype = 'p');
  -- 결과: UNIQUE constraint 있음/없음 + 컬럼 list (user_id, word) 인지 확인
  ```
  → **있음** = `ON CONFLICT (user_id, word) DO NOTHING` 그대로 작동, stable dedup 식 단순화 가능
  → **없음** = dedup 식이 `WHERE NOT EXISTS (...)` 로 강제 (race condition 가능성)

- [ ] **B2. subscription 분리 구조** (vocabularies vs user_word_set_subscriptions)
  ```sql
  -- subscriptions 가 set-level, vocabularies 가 word-level 분리됐는지
  SELECT
    (SELECT count(*) FROM user_word_set_subscriptions) AS sub_rows,
    (SELECT count(*) FROM vocabularies) AS vocab_rows,
    (SELECT count(*) FROM vocabularies WHERE shared_set_id IS NULL) AS orphan_vocab,
    (SELECT count(*) FROM vocabularies WHERE shared_set_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM user_word_set_subscriptions s
                   WHERE s.user_id=vocabularies.user_id AND s.set_id=vocabularies.shared_set_id)
    ) AS vocab_with_sub;
  -- 결과: vocab 이 sub 없이 존재 가능한가? = subscription 분리 정도
  ```
  → **완전 분리** (vocab 이 sub 없이 가능) = P6.1 의 i+1 필터를 vocabularies INSERT 단에만 적용해도 충분
  → **연동** (vocab = sub 의 child) = subscriptions 단계에도 i+1 필터 필요 (이중 게이트)

### 결정표 (사용자 확정 요청)

> 권장 default 는 **B1·B2 결과 + 0-2/0-3/0-4 측정값** 을 본 후 Project 가 최종 산정.
> 본 표의 default 는 측정 전 예비값 — P6.0 보고 후 조정 가능.

| 결정 | 항목 | 예비 default | 확정 |
|---|---|---|---|
| E1 | i+1 필터 범위 | `v_level BETWEEN GREATEST(N-1,1) AND LEAST(N+1,11)` (3-band Krashen) | ? |
| E2 | 진단 미완료 fallback | book_v_level 사용 (현재 책 난이도 따라) 또는 V5 default | ? |
| E3 | stable dedup 임계 | stability >= 21 일 (3주) — 0-3 측정 후 보정 |  ? |
| **E4** | **세션 cap (책당 vocab import)** | **50** — 0-4 avg 책/user 측정 후 최종 산정 | ? |
| E5 | 다국적 fallback | V5 base | ? |
| E6 | book_v_level UI 차단 | DB 차단 X, UI 권장만 | ? |
| **E7 (B1)** | UNIQUE(user_id, word) 가정 | B1 결과로 확정 | ? |
| **E8 (B2)** | subscription 분리 정도 | B2 결과로 확정 | ? |

> **E1~E4 + E7·E8 확정 전 P6.1 이후 착수 금지.**

### P6.0 보고 형식 (Project 측에 제출)

```markdown
## P6.0 진단 결과

### 측정
- 0-1 _enroll_book_subscribe_word_sets 본문: [INSERT 절 구조 + WHERE 조건 요약]
  · 필수: vocabularies INSERT SELECT 의 JOIN/WHERE 라인 + ON CONFLICT 절 본문 그대로
  · P6.1 i+1 필터 삽입 위치 결정 근거 (이 측정 없이 P6.1 spec 불가)
- 0-2 user_profiles 충전: __% (N=__)
- 0-3 vocabularies stable: __개 (stable_21d/total = __%)
- 0-4 avg 책/user: __ (p90 __)
- 0-5 V-level gap 분포: gap = user_v − book_v, bucket [-3..+3], [표]
  · 정의: gap > 0 = 사용자가 책보다 낮음 / gap < 0 = 사용자가 책보다 높음
  · bucket 외 (gap ≤ -4 또는 ≥ +4) 카운트도 별도 row
- 0-6 enroll_library_book chain: [본문 요약]
- 0-7 extract_vocabulary_for_user i+1 식: [요약]
- 0-8 (선택 — P6.6 소급 ROI) 기존 vocabularies i+1 위반 / stable-dup row 수:
  · `count(*) FILTER (WHERE v_level NOT BETWEEN user.current_v_level-1 AND user.current_v_level+1)`
  · `count(*) FILTER (WHERE stability >= 21 AND created_at > '<재발행 시각>')`

### Binary
- B1 UNIQUE(user_id, word): 있음/없음 (제약명 __)
- B2 subscription 분리: 완전/연동 (vocab without sub = __ rows)

### 권장 결정
**(Project 산정 — 측정값 + 권장 default 기반)**
E1=…, E2=…, E3=…, **E4=…**, E5=…, E6=…

**(B1·B2 결과 전사 — Project 산정 아님)**
E7=… (B1 결과로 자동) · E8=… (B2 결과로 자동)

### P6.6 소급 정책 권장
[F0/F1/F2/F3 중 0-8 측정 + 0-3 review_count=0 비율 기반]
```

---

## P6.6 — 소급 정책 (P6.1~P6.3 적용 후 기존 vocabularies 처리)

> **새 단계** — P6.0 보고와 함께 결정 필요.

P6.1~P6.3 (i+1 필터 + stable dedup + 세션 cap) 적용 후 **이미 import 된 기존 vocabularies 를 어떻게 처리할지** 의 정책.

### 배경

본 작업 (PR #24) 의 재발행으로 사용자 1명에게 4,862 vocabularies row 가 이미 import 됨 (V6~V11 전체). 이 중:
- V5 사용자 기준 i+1 필터 적용 시 V4~V6 만 → V7~V11 = ~3,500+ row 가 "i+1 외" 가 됨
- stable dedup 기준 적용 시 stability >= 21 단어는 다음 book enroll 시 SKIP (소급 영향 0)
- 세션 cap = 50 적용 시 책당 50 초과분이 "cap 외" 가 됨

### 옵션

| ID | 동작 | 진도 영향 |
|---|---|---|
| **F0** | 보류 — 기존 vocabularies 유지, 새 enroll 만 P6.1~P6.3 적용 | 0 |
| F1 | i+1 외 row 만 archived 처리 (soft hide) | 진도 보존, UI 에서 안 보임 |
| F2 | i+1 외 row 명시 DELETE | 진도 손실 (review_count > 0 인 row 보호 가드 필요) |
| F3 | 책별 unenroll 후 재enroll (P6.1~P6.3 자동 적용) | 진도 0 인 row 만 영향 (review_count=0 만) |

### 결정표 추가

| ID | 항목 | 권장 |
|---|---|---|
| **F** | 소급 정책 | F0 (보류) — 안전 default. 사용자 결정 필요 |

> P6.0 보고 시 0-3 의 `review_count = 0` 비율이 매우 높으면 F3 도 안전 (현 dev 환경 정합).

---

## flag 2 (참고) — P6.6 소급 정책 도입

본 P6.6 섹션이 flag 2 결정 사항. P6.1~P6.5 와 별도 결정 (사용자 진도 보호 정책).

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

## 착수 순서 (엄격 게이트)

```
P6.0 (진단 read-only) + B1·B2 binary
  └─ Project 보고 (위 "P6.0 보고 형식")
      └─ 사용자 결정 E1~E8 + F (P6.6 소급)
          └─ P6.1 (i+1 필터)
              └─ P6.2 (stable dedup)
                  └─ P6.3 (세션 cap)
                      └─ P6.4 (extract 정합)
                          └─ P6.5 (Layer 통합 검증)
                              └─ P6.6 (소급 정책 F 실행)
```

**🔒 게이트 엄수**:
- Code 가 P6.0 단독 실행 후 P6.1 자동 진입 금지
- 결정 E4 + F 가 Project 보고에 미정인 상태에서 P6.1~P6.6 착수 금지
- B1·B2 binary 결과가 없으면 결정 E7·E8 불가 → P6.1 식 설계 불가

---

## 한몸 한계 (manifest §5 그대로)

- Project = spec 검토/설계/지시문 작성/측정값 분석
- Claude Code 단독 = DB query · migration 적용 · 함수 dump/수정 · git/PR

본 handoff 는 Project 가 검토/보강 후 Claude Code 에 위임.

---

*P6 handoff 작성: 2026-06-20*
*선행 PR: #24 (P0~P4 + 재발행, v06.77~82)*
