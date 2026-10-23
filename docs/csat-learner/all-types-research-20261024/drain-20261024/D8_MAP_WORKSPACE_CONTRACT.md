# D8 — 기출분석 × 학습지도 · Workspace 계약 추적

> 연구 산출물(읽기 전용). 작성: Claude 서브에이전트 D8 · 내부 검토만, 공식 독립 수용 아님.
> 기준: main `e3e0a6a0e`(코드는 `git show main:`), DB `jajenrevcbmrpaliomxv` SELECT 2건(뷰 정의 1 · 집계 1).
> 계약 기준: 14_PRODUCT_DECISIONS §기록 표("탐색·클릭·강의 청취·해설 열람은 숙달에 산입하지 않는다"), DECISIONS.md L149 · L167 · L180 · L218.

## 결론 요약

- **열람·클릭·탐색·강의 완주 → 학습지도 숙달(해소·resolved) 경로: 코드상 발견 못 함.** 지도 TASK 상태의 숙달 쪽 값(`resolved` · `checking`)은 `skillDiagnosis` 의 독립 첫 시도에서만 나오고, 그 자격은 `isEligible` + `attemptRole === 'independent_check'` 로 막힌다. 강의(lecture) 는 `lib/csat/map` · `components/csat/diagnosis/map` · 진단 API 어디에서도 참조되지 않는다(grep 0건).
- **정답·해설을 본 뒤 풀이 → 독립 수행 기록: 막혀 있음.** 공개 라우트가 세션에 `explanation_viewed_at` 을 쓰고, 뷰 `learning_first_attempts` 가 `after_explanation` · 다른 세션 도움(`cross_help`, 2분 창) · 시각 불확실을 판정하며, 뷰는 (사용자·과제·문항·단계)마다 **첫 시도만** 남긴다.
- 남는 위험은 숙달이 아니라 **축 proxy(「관찰됨」)** 와 **자기 체크 완료 수** 쪽이다(D8-01 · D8-02, 모두 P2/P3).

## 단계별 추적

| # | 단계 | 구현 위치(main) | 전달 데이터 | 계약 일치 | 결함 |
|---|---|---|---|---|---|
| 1 | 지도에서 문항 진입 | `components/csat/diagnosis/map/GoalPlanSummary.tsx`(테스트가 `/csat/learn/<id>?d=…&from=map&map_task=…&ws=…` 확인) · `TaskInspector.tsx:178~` · `HomeLanding.tsx:168` | 쿼리 `from=map` · `map_task` · `ws` · `step` | 일치(L180 「활동 시작」= 아직 안 한 대상 하나) | 없음 |
| 2 | 목표·TASK 맥락 전달 | `app/(app)/csat/item/[slug]/page.tsx:88` `carry` · `:268` 주석("모두 검증한 값") · `factory/[deliveryId]/page.tsx:39,71`(로그인 복귀 URL 에도 보존) · `V3CompareExplorer.tsx:127`(비교 이동 시 이어 줌) | 쿼리만(서버 상태 아님). 납품 결속은 본문 `deliveryId`(task route) | 일치 | 없음 |
| 3 | 기출분석 활동 시작 | `api/csat/item/[slug]/task/route.ts` → `recordItemTaskAttempt`(product-server.ts:198~209 `writer.reveal` 로 세션 생성 → `writer.record`) | `learning_sessions`(help_level 한 번 정하면 불변, learning-session.ts:159) · `learning_task_attempts`(service_role 만 쓰기) | 일치 | 없음 |
| 4 | 정답 열람 | `api/csat/item/[slug]/reveal/route.ts:6,51` — `learning_session_apply(stage revealed, p_explanation_viewed_at)` 별도 mutation, 시도 아님 | `learning_sessions.explanation_viewed_at` · `explanation_server_at` | 일치(L149 문항 열면 `viewed_first`) | 없음 |
| 5 | 해설 후 확인 | 뷰 `learning_first_attempts`(DB 정의 SELECT): `after_explanation = answered_at >= s.explanation_viewed_at`; `cross_help` 가 **다른 세션**의 도움·해설(2분 전)을 `viewed_first` 로 | 뷰 컬럼 `after_explanation` · `after_viewed_first` · `timing_uncertain` | 일치(14 `checked_after_explanation` = 숙달 아님) | 없음 |
| 6 | 독립 수행 | `lib/knowledge/effect-signals.ts:79-87 isEligible` · `map/v62/assessment-exposure.ts:112-120 attemptRole`(activity theater + phase practice + help independent + session_id + content_hash 일치만 `independent_check`) · `map/practice-results.ts:66-70 firstIndependent` | 위 뷰 + `learning_task_attempts.content_hash` | 일치 | D8-03(P3) |
| 7 | 숙달 판단 | `map/skill-diagnosis.ts:124`(독립 첫 시도만) · `map/v4/as-is.ts:141-149 SKILL_TO_TASK`, `:227,245` | `resolved` 은 서로 다른 지문 연속 2정답 + 다른 날 재확인(skill-diagnosis.ts 머리 주석 L9-15) | 일치(L180 「해소는 다시 확인의 독립 첫 시도에서만」) | 없음 |
| 8 | 학습지도 복귀 | item page `?from=map…` 복귀 링크 `:318` · `V3CompareExplorer` returnTo | 쿼리 | 일치 | NOT_VERIFIED(브라우저) |
| 9 | Workspace 상태 복구 | `TaskInspector` `restoreWs` · `homeWsOf` · `data.v4.saved.byTemplate`(저장 계획 `loadSavedPlans`, load.ts:385) | `ws` 쿼리 + DB 저장 계획 버전 | 일치 | NOT_VERIFIED(브라우저) |
| 10 | 재로그인 후 일관성 | 모든 판정이 읽을 때 DB 에서 재계산(`load.ts` 가 user_id 로 attempts · first_attempts · sessions · `csat_map_task_done` 재조회). task route 는 `ownerId` 불일치 시 409(계정 전환 재시도 차단) | 서버 기록만 · 클라이언트 상태 의존 없음 | 일치(코드 기준) | NOT_VERIFIED(실제 재로그인 E2E 미실행) |

## 발견

| ID | 내용 | 근거 위치 | 재현 조건 | 심각도 | 신규/KNOWN | 원본 감수 |
|---|---|---|---|---|---|---|
| D8-01 | 시험 기록(`csat_dx_session`, mode live/retake/app) 입력 라우트가 해당 시험 문항의 **사전 해설·정답 열람 여부를 보지 않는다**. 그 기록이 진단 스냅샷(attribute_mastery) → 지도 축 proxy(`observed`/`check_first`, as-is.ts:250-262, basis `axis_proxy`)로 간다. 숙달(`resolved`)로는 안 가지만, 해설을 다 본 시험을 live 로 입력하면 「축 관찰」 이 부풀 수 있다. retake 는 `retake_weight`(rule-v1.ts:94)로만 낮춘다 | `api/csat/diagnosis/sessions/route.ts`(learning_sessions · explanation 참조 grep 0건) · `diagnosis/server.ts:177-198`(Reveal Gate 만 적용) | 문항 N개 해설 열람 → 같은 시험을 `/csat` 시험 기록으로 live 입력 → 지도 축 상태 | P2 실제품(표시가 「관찰됨」 이고 숙달 아님). 실데이터: dx_session 3건 중 「열람 뒤 입력」 0건 — 단 item_ref↔exam_id 접두 매칭이라 형식 차이 시 과소 집계 가능(NOT_VERIFIED) | 신규 | 아니오 |
| D8-02 | `csat_map_task_done`(학습자 자기 체크, server.ts:60/71 upsert·delete)이 라인 `tasks.done/rate` 로 집계된다(model.ts:182-186). 라인 성취(`achieved`)·`lineStatus` 에는 안 쓰이고 D 라인은 `tasks_only` 로만 표시 → 숙달 아님. 다만 클릭 한 번이 「완료 수」 로 보이는 표시 경로이므로 문구가 달성으로 읽히지 않는지 화면 확인 필요 | `lib/csat/map/model.ts:182-226` · `lib/csat/map/server.ts:60,71` | 지도에서 과제 완료 체크 | P3 실제품(표시 문구 의존) | 신규 | 아니오 |
| D8-03 | 뷰에서 세션이 없는(`s.id IS NULL`) 시도는 `help_level` 을 클라이언트가 보낸 값 그대로 쓴다. 그러나 `attemptRole` 이 `session_id` 를 요구해 `independent_check` 가 못 되므로 숙달 경로는 닫힘. 또 클라이언트 `answeredAt` 은 열람 시각보다 앞당겨 보낼 수 있으나 `received_at - answered_at > 2분` 이면 `timing_uncertain` 으로 보류 — 2분 미만 앞당김은 열람 시각과 2분 이내라 역시 uncertain. 우회 경로 미발견 | 뷰 `learning_first_attempts` CASE(`WHEN s.id IS NULL THEN a.help_level`) · assessment-exposure.ts:116 | 세션 없이 직접 POST(현재 라우트는 항상 `writer.reveal` 로 세션을 만든다) | P3 격리(방어 깊이) | 신규 | 아니오 |
| — | 해설 극장 이해 확인은 항상 「설명 후 수행」, 정리 열람·원리 보관·해설 뒤 연습은 숙달 아님 | DECISIONS L167 · L218 · dissect.ts:124 | — | — | KNOWN(DECISIONS L167·L218 · 14 §기록 표) | — |
| — | Practice 화면 기록(`activity='practice'`)은 확인 근거 아님 | isEligible:80 · as-is.ts:227 · load.ts 주석 find-policy.v3 | — | — | KNOWN(find-policy.v3) | — |

## 조사 범위(실제로 본 개수)

- main 소스 파일 직접 읽음 12: load.ts · practice-results.ts · v4/as-is.ts · model.ts · target.ts · skill-diagnosis.ts(머리) · effect-signals.ts(isEligible) · assessment-exposure.ts(attemptRole) · item task route · product-server.ts(부분) · TaskInspector.tsx(부분) · learning-session.ts(grep). grep 범위: `apps/web/src` 의 from=map · lecture · mastery · explanation_viewed_at.
- DB: 뷰 `learning_first_attempts` 정의 1 · dx_session 열람 후 입력 집계 1.
- 문서: 00_ASSIGNMENT · DECISIONS.md(grep) · 14 · 17(grep).

## 완료/부분/미완료

- 완료: 10단계 코드 경로 · 두 핵심 질문(열람/강의→숙달, 정답 열람 후 풀이→독립) 판정.
- 부분: Workspace 복구 · 복귀 · 재로그인은 코드 읽기만.
- 미완료: 브라우저 E2E, `feat/lecture-learner-control`(6eb6f3451) 의 강의 진행 기록이 지도로 가는지(main 밖 — main 에는 없음).

## 미검증

- NOT_VERIFIED: 실제 재로그인 · 복귀 · ws 복구 화면 동작 · D8-01 실데이터 매칭(item_ref 형식) · `learning_session_apply` RPC 본문(pg_proc 소스 미조회) · `csat_map_task_done` 표시 문구 · 강의 브랜치의 기록 경로.
