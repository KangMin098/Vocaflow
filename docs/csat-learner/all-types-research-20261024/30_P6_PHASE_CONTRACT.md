# 30 · P6 단계 계약 — learning_task_attempts 의 「독립 수행」 판정

> 2026-10-24 · READ-ONLY 조사(main 코드 + vocaflow-dev SELECT). 코드·DB 변경 없음. 제안 SQL 은 미적용 초안.

## 근거 위치 (main)

- `apps/web/src/lib/csat/map/curriculum.ts` — `CycleCell.stage: 'FIND'|'REPAIR'|'TRANSFER'|'CHECK'`, `lifecycleCells()` (L140~186)
- `apps/web/src/lib/csat/map/lifecycle-evidence.ts` — 단계 정의 머리말 (L1~10), `repairSuccess` · `guidedRepairAttempts` · `isInstructional` · `isKiceRepairTarget`
- `apps/web/src/lib/csat/map/skill-diagnosis.ts` — FIND 확정 / CHECK 해소, 「독립 첫 시도」 · `seenAt`
- `apps/web/src/lib/knowledge/effect-signals.ts:79` — `isEligible()`
- `apps/web/src/lib/csat/map/v62/assessment-exposure.ts:112` — `attemptRole()`, 노출 원장 `ExposureSource = g2_attempt|g2_session|trap|paper|review_queue|dx_response`
- `apps/web/src/lib/csat/map/v4/as-is.ts:~225~248` — `independentItems`, `sources.kind='independent_attempts'`
- `apps/web/src/lib/csat/map/load.ts:190~258` — `loadCrossVerdicts`, `learning_first_attempts` 읽기, `expectedContentHash = task.def.hash(task.ann)`
- DB view `public.learning_first_attempts` — 행 단위 help_level 재계산 · after_viewed_first · after_explanation · timing_uncertain · synthetic(세션 OR)

## (1) 단계 ↔ 원장 열 대응

단계 전용 열은 없다. 단계는 **행 열(phase·activity·task_key) + 시각 + 확정 회차(verifiedAt)** 로 소비자가 계산한다.

| 지도 단계 | 원장 근거 | 근거 코드 |
|---|---|---|
| FIND(직접 확인) | `activity='theater' AND phase='practice'`, 확인 묶음의 `task_key|item_ref`, 독립 첫 시도. 서로 다른 2문항 오답(맞힌 문항 없음)이면 확정 | skill-diagnosis L7, L120~126; attemptRole → `independent_check` |
| REPAIR(바로잡기) | 확정 뒤 막혔던 **기출** 문항 재시도 정답(`item_ref` 가 `authored:` 아님), 또는 서버가 결속한 `repairRole='guided_practice'`(authored practice). 도움·해설 뒤도 허용 | lifecycle-evidence L5~6, L42~70 |
| TRANSFER(적용) | 확정 뒤 같은 task_key 의 확인 묶음 밖 문항, 또는 `phase='transfer'`(attemptRole `theater+transfer`). 정오·독립·합성 따지지 않음 | lifecycle-evidence L7~8 |
| CHECK(다시 확인) | 확정 뒤, 확정에 쓰지 않은 **미노출** 확인 문항의 독립 첫 시도(theater/practice). 연속 2개 정답(+ 코드북: 다른 지문·다른 날) | skill-diagnosis L9~16 |

`pre|post|delayed|review` phase 는 지도 단계 소비자가 읽지 않는다(skill-diagnosis 는 `phase !== 'practice'` 를 건너뜀). 이 phase 들의 단계 대응은 **없음**. `activity='dissect'` 도 단계 대응 없음(attemptRole → `unbound`).

## (2) 독립 근거가 될 수 있는 단계 / 절대 안 되는 단계

- 가능: **FIND, CHECK** 만(`attemptRole = independent_check`). `phase='transfer'` 는 isEligible 에서 role `transfer` 일 때 효과 신호(집단) 자격은 있으나, 지도 직접 확인(skillDiagnosis)은 세지 않는다.
- 불가:
  - REPAIR 행 전부(도움 허용 단계 · 같은 문항 재노출). 재시도 정답을 독립 확인으로 승격 금지.
  - `activity='practice'`(연습 화면 · authored 안내 연습) — isEligible L80, find-policy.v3.
  - TRANSFER — 수행 경험 기록일 뿐 진단 근거 아님(lifecycle-evidence L8).
  - `review`, `dissect`, 해설 열람 뒤 행.

## (3) 필요 조건 (모두 AND)

1. 역할: `activity='theater' AND phase='practice'`, task_key = 확인 과제 키(attemptRole 의 `e.taskKey === expect.taskKey`).
2. 도움: view 기준 `help_level='independent'`(원 행이 아니라 **세션 재계산값**), `NOT after_viewed_first`, `NOT after_explanation`. 다른 세션의 help/explanation 시각이 2분 이상 앞서면 `viewed_first`(cross_help.helped).
3. 시각 신뢰: `NOT timing_uncertain`(±120초, 수신 지연 >2분, `help_clock_suspect`, 서버/클라 시각 역전). 불확실 → 보류(제외 아님, `timingHeld` 로 따로 셈).
4. 결속: `session_id IS NOT NULL`, `content_hash IS NOT NULL` 이고 **현재 문항 주석 해시**(`currentItemTask(item_ref).def.hash(ann)`) 와 일치. 지난 판본 해시는 `unbound`.
5. 정오: `is_correct IS NOT NULL`, `answered_at IS NOT NULL`.
6. 첫 시도: 문항별 가장 이른 독립 시도 1건(view 는 `(user, task_key, item_ref, phase)` DISTINCT ON). CHECK 는 추가로 `seenAt`(과제 키·phase 무관 첫 노출) 이 확정 뒤여야 하며, 노출 원장(trap·paper·review_queue·dx_response) 에서 `exposed` 면 미노출 CHECK 아님. 원장 조회 실패 → `unknown`(독립 아님).
7. 합성: 본인 지도 판정은 합성도 포함(skill-diagnosis L122), 집단 통계(effect-signals)에서만 제외. 상태에 `synthetic` 을 따로 실어 소비자가 고르게 한다.
8. `application_id`/`trial_id`: 현 지도 소비자는 요구하지 않음(authored 제출은 `p_application_id: null`). 효과 신호 집계에만 사용.
9. `sec` 범위: 현 코드에 하한/상한 규칙 없음 — 조건으로 넣지 않는다(NOT_VERIFIED).
10. 추적 전 기록: `session_id` 없거나 `received_at` 없는 옛 행은 `unbound`/`legacy_unknown` — 독립으로 소급 승격하지 않는다.

## (4) 제안 — `learning_attempt_independence` (초안 · 미적용)

```sql
-- 초안: view. content_hash 기대값은 DB 에 없으므로(코드 계산) 소비자가 넘기거나 별도 표가 필요 → 여기선 hash_bound 를 NULL(미판정)로 둔다
create view public.learning_attempt_independence as
select f.attempt_id, f.user_id, f.task_key, f.item_ref, f.phase, f.activity, f.synthetic,
  case
    when f.activity is null or f.phase is null or f.task_key is null       then 'unbound'
    when f.activity = 'practice'                                            then 'practice'
    when f.phase = 'transfer' and f.activity = 'theater'                    then 'transfer'
    when not (f.activity = 'theater' and f.phase = 'practice')              then 'unbound'
    when f.help_level is null                                               then 'legacy_unknown'
    when f.help_level <> 'independent' or f.after_viewed_first or f.after_explanation then 'helped'
    when f.timing_uncertain                                                 then 'timing_held'
    when f.session_id is null or a.content_hash is null                     then 'unbound'
    when f.is_correct is null or f.answered_at is null                      then 'ungraded'
    else 'independent_candidate'   -- 해시 일치·미노출·첫 시도 여부는 소비자(코드) 판정
  end as status
from public.learning_first_attempts f
join public.learning_task_attempts a on a.id = f.attempt_id;
```

- RLS: view 는 `security_invoker = true` 로 본인 행만.
- 소비자 규칙: `independent_candidate` 는 **근거 후보**일 뿐이다. 지도 상태(verified/resolved)는 오직 `skillDiagnosis`(첫 시도·노출·코드북·만료) 가 정하며, 어떤 status 도 숙달·해소를 자동 승격하지 않는다. `transfer`·REPAIR 행은 lifecycle 칸 「마침」 표시에만 쓴다. `timing_held` 는 보류 표시, `unknown/legacy_unknown` 는 미측정으로 둔다.

## (5) NOT_VERIFIED · 공백

- DB 실측(2026-10-24): 원장 129행 전부 `theater/practice`; independent 125(합성 124, 실사용자 1), viewed_first 4; content_hash·session_id·is_correct 결측 0. transfer/repair/pre·post 행 0 → 다른 단계 경로는 실데이터로 미검증.
- `answer_direct` · `decisive_hint` 문자열은 main 의 apps/web·migrations·docs 에서 발견되지 않음 — 이 노출 종류의 정의·저장 위치 미확인.
- 기대 content_hash 가 DB 에 없음(코드 `def.hash(ann)`) → SQL 만으로 판본 결속 불가.
- `sec` 이상값 규칙, `pre/post/delayed/review` phase 의 생산자·소비자 미확인.
- 노출 원장 `trap|paper|review_queue|dx_response` 의 DB 출처별 완전성 미검증.
- T-0096 R5/E2 원문은 직접 열람하지 않음(skill-diagnosis 주석의 E3·R2 만 확인).
