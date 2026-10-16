# LM-G1.2 — R5 실제 수행 · 학습지도 · Workspace · PLAN 종단

> 기준 main `7e7b51ab7`(PR #272 LM-G1.1 수용 병합) · 브랜치 `feat/lm-g1-2-r5-vertical`.
> 범위: R5(`r.central_meaning`) 한 TASK 의 수직 경로 — 학습지도 → Workspace → 수행 → 원자 저장 → 증거 판정 → MAP/Workspace 재계산 → PLAN 버전 → 다음 학습.
> **증거 층위**를 섞지 않는다: ① 순수 함수 ② 개발 DB · 기존 API ③ 실제 Chromium ④ 학습 효과. ①–③ 을 통과해도 ④ 는 **NOT_CLAIMED**.
> 새 저장 엔진 · 새 화면 · DB/RPC/RLS 변경 없음. 실제 학생 기록 변경 · 삭제 없음(실행별 합성 계정만 · 끝에 삭제 · 부재 확인). 독립 검증(Codex) 전 — ACCEPT · 전체 목표 완료를 선언하지 않는다.

## 1. TRANSFER 1회 / 2회 계약

### 근거(정본)

`docs/csat-learner/v4/workspaces.json` `ws.central-meaning`:
- `quantity_policy`: 「확인 묶음 1회 + 바로잡기 막힌 문항 수만큼 + **전이 2지문** + 다른 날 재확인 2문항」 — **운영량**
- `criterion`: 「서로 다른 지문 2개 독립 정답 → 120일 안 재확인 2연속 정답(resolved)」 · `independent_check`: skill-diagnosis — **능력 판정은 CHECK**

### 결함(수정 전)

| 표면 | 적용 1회 뒤 |
|---|---|
| PLAN · Workspace 행 · 팝업 · 모달(`stageNow`) | 「다른 글에 적용」 1/2 — 다음 행동 = 두 번째 적용 문항 |
| 근거 드로어 → 기출 근거 자세히(lifecycle 4칸 · 처방 · `nextLifecycleAction`) | 「다른 글에 적용함 · **마침**」 · 다음 = 다시 확인 |

같은 순간 두 화면이 다른 다음 행동을 말했다(1회 경험을 계획 완료로 봄). 또 학습자가 저장한 적용 계획량(예: 1)은 단계 판정에 들어가지 않았다.

### 계약(`lifecycle-evidence.ts` `TransferContract`)

| 값 | 뜻 | 출처 |
|---|---|---|
| experience | 적용을 한 번이라도 했는가 | 기존 `transferAt` **그대로 보존** |
| progress | 서로 다른 적용 문항 수 / 운영 계획량 | `transferDoneOf`(계획 · lifecycle 공용 — 같은 TASK 키 · skeleton 포함 · 확정 뒤 · 문항 중복 1) / `transferTarget`(저장 계획의 적용 계획량 ≥1 · 없으면 정본 2 · 가용 이하 · 가용 0 이면 null) |
| ready | 다시 확인으로 넘어갈 운영 조건 | progress.done ≥ planned 일 때만 · 자료 없음 = null(건너뜀 · 완료 아님) |
| evidence | 능력 주장 | `experience_only` 까지 — 독립 적용 능력은 CHECK 가 판정 |

다음 행동 우선 출처: **PLAN(운영 계획량)** — 정본 quantity_policy 가 운영량을 정하므로. lifecycle 은 `transferDone` · `transferPlanned` 를 받으면 같은 기준(`transferFinished`)을 쓰고, 받지 않으면 예전 호환(첫 경험)을 유지한다.
저장 계획량은 **「적용」 단계로 저장된 TASK** 의 계획량만 쓴다(`savedTransferOf` — 다른 단계로 저장한 계획량을 옮기지 않음 · 0 · 비정수 무시). 계획량 조정은 운영량만 바꾸고 성취 · 직접 확인 판정은 읽지도 바꾸지도 않는다.
CHECK 선통과(resolved): 바로잡기부터 다시 하라고 하지 않는다. 기존 정본(to-be `resolved_not_transferred`)의 「다른 글에 적용」 권고(낮은 순위 요구)는 그대로 — 이번에 바꾸지 않았다.

반례(`v4/__tests__/transfer-contract-lm-g1-2.test.ts` 10/10): 0회 · 1회(PLAN = lifecycle = 적용 · 4칸 「적용 1/2 · 첫 적용 경험」 · 호환 경로는 예전대로) · 2회 다른 문항(다시 확인 · 성취 그대로) · 같은 문항 반복(1) · 다른 TASK 키(0) · 계획량 1 조정(1회 뒤 다시 확인 · 계획량 1 표시) · 저장 단계 · 0 · 상한 · 자료 없음 · CHECK 선통과 · 시각 불확실 보류 수.

## 2. 근접 해설 노출 · 시각 불확실성

### 데이터 흐름

- 쓰기(M8): 확인 과제 제출 → `learning_task_attempts`(answered_at · received_at · session_id · item_ref · task_key · phase) · 해설/도움 열람 → `learning_sessions`(help_received_at · explanation_viewed_at · help_server_at · explanation_server_at · help_clock_suspect). 첫 시도 뷰 `learning_first_attempts` 가 같은 세션 안의 도움(after_explanation · after_viewed_first)과 기록 시점 판정(timing_uncertain)을 싣는다.
- 읽기: `load.ts loadFindAttempts` → `loadCrossVerdicts` → `prior-help.crossSessionHelp`(다른 세션의 도움 · 해설) → `helped` 이면 도움받음, `uncertain` 이면 `timingUncertain` → `isEligible` 에서 빠짐(독립 근거 보류). 원장 조회 실패는 전부 uncertain(보수).

### 반례 A–H(`lib/knowledge/__tests__/prior-help-lm-g1-2.test.ts` 11/11 — 현행 정책 고정)

| | 상황 | 판정 |
|---|---|---|
| A | 제출 뒤 5분에 다른 세션 해설 | 독립 |
| B | 다른 세션 해설 2분 넘게 먼저 | 도움받음 |
| C1 | 해설이 30초 먼저(2분 안) | 보류 |
| C2 | 제출 뒤 60초에 다른 세션 해설 · 서버도 제출을 먼저 받음 | **보류**(과잉 보류 후보 — 관찰) |
| C3 | 같은 세션 안 제출 → 해설 | 이 규칙 대상 아님(독립) |
| D | 다른 탭 · 세션 | 앞섬 = 도움 · 근접 = 보류 |
| E · E2 | 도움 기기 시계 의심 · 판단 기기 시계 늦음 | 보류 |
| F | 서버 수신 지연 폭 안 | 보류 |
| G | 같은 지문 **다른 문항**의 선노출 | 독립 — 문항 단위 규칙이라 보지 않음(**정책 공백 후보**) |
| H | 해설 기록 없음 · 시각 불명 | 그 세션은 판정에 안 씀 · 원장 조회 실패는 로더가 보류 |

### 영향 실측(읽기 전용 · `scripts/research/lm-g1-2/prior-help-impact.ts` → [prior-help-impact.json](./lm-g1-2/prior-help-impact.json))

개발 DB 확인 과제 첫 시도 125건(42명 · 합성 122): 독립 123 · 도움 2 · **보류 0**(C2 형 0). 정책을 바꿀 실측 근거가 없다 — **2분 보호 그대로**.
정책 v2 제안(미적용 · 별도 승인 · 버전 필요): ① C2 — 「다른 세션 해설의 서버 시각 > 제출 서버 수신」이면 근접이어도 독립으로 풀기(기기 시계 대신 서버 순서) ② G — 같은 지문 세트(41–42 · 43–45)의 선노출을 도움으로 보기. 둘 다 판정 버전을 올리고 기존 판정과 섞지 않아야 한다.

### 화면 — 보류 사유(짧게 · 실패 아님)

`AsIsTask.check.timingHeld`(보류한 확인 문항 수) → 빠른 팝업 「· 보류 n개(제출 · 해설 순서 확인 불가 — 실패 아님)」 · 근거 드로어 「확인 문항 n개는 해설 열람 시각과 제출 순서를 확인할 수 없어 이번 독립 확인에 반영하지 않았어요 — 틀렸다는 뜻이 아니에요.」

실제 브라우저(`e2e-lm-g1-2-timing.mjs` 2/2): 제출 → 약 10초 뒤 다른 세션에서 같은 문항 해설 → 원장: 다른 세션 해설 · 도움 기록 + 서버 시각, 첫 시도 `timing_uncertain = true` → 지도: R5 근거 「아직 확인 전」(확인된 요구 아님) · 팝업 · 드로어 보류 안내 1개. [진단](./evidence/lm-g1-2-20261016/timing/ledger-diagnosis.json)

## 3. 저장 · 조회 · 재계산 흐름(재사용 — 새 엔진 없음)

```
확인 · 바로잡기  POST /api/csat/item/{slug}/task  → recordItemTaskAttempt → writer(reveal · record) → learning_task_attempts · learning_sessions
적용            POST /api/csat/practice/attempt   → submitPractice → learning_task_attempts(phase transfer)
목표            PUT  /api/csat/diagnosis/map/goal → csat_map_goal(+ 목표 이력)
계획            POST /api/csat/diagnosis/map/plan → parseCommitRequest · findCommitByKey(멱등) · buildCommitPayload · plan-commit RPC → learner_workspace_plan(append-only)
읽기            loadMapPage → loadFindAttempts(+ crossSessionHelp) · loadLifecycleActivity(is_correct) · loadSavedPlans
재계산          composeV4 → asIsMap(skillDiagnosis) → toBeMap → planWorkspaces → workspacePlan/allTaskPlans(+ savedTransferOf) → ranksOf → 화면
```

## 4. R5 실제 수직 — 단계별 결과

`scripts/csat/map/v62/e2e-lm-g1-2.mjs` — 쓰기는 합성 계정 본인의 기존 API, 원장은 서비스 키 **읽기 전용** 대조, 같은 사용자 · TASK · 문항 · phase 결속. 결과는 실행 SHA · 시각 · 폭과 함께 `results.json`.

| ID | 확인 | 층위 | 1440 | 1280 |
|---|---|---|---|---|
| R01 | 목표 80 저장 — API 200 · 원장 1행(본인) | db | PASS | PASS |
| R02 | 시작 — R5 직접 확인 전 · 확인 단계 · 모든 표면 같은 확인 문항 | browser | PASS | PASS |
| R03 | FIND 2 실패 — 원자 저장(task_attempts 2 · first_attempts 2 · 같은 과제 키 · phase practice · 오답 · 서버 수신 시각) | db | PASS | PASS |
| R04 | 지도 재계산 — R5 확인된 요구 · REPAIR · 모든 표면 같은 막힌 문항 | db+browser | PASS | PASS |
| R05 | REPAIR 2 실패 — 원장 4행 · 수행 2 · 다음 REPAIR · 재시도 링크 = 막힌 문항 | db+browser | PASS | PASS |
| R06 | REPAIR 정답 — 원장 정답 1 · TRANSFER 진입 · 0/2 · 적용 문항 링크 일치 · 성취 그대로 | db+browser | PASS | PASS |
| R07 | PLAN v1 저장 · 같은 요청 재전송 = 같은 버전(reused) · 같은 키 다른 본문 409 · 낡은 버전 409 · 행 1개 | db | PASS | PASS |
| R18 | 저장 실패(500 주입) — 오류 표시 · 「저장됨」 아님 · 저장 버전 그대로 · 원장 행 그대로 | db+browser | PASS | PASS |
| R08 | TRANSFER 1회 — 원장 transfer 1행 · PLAN 1/2 · 여전히 적용 · 다음 링크는 다른 적용 문항 | db+browser | PASS | PASS |
| R18b | 저장 실패 뒤 초안은 남되(미저장 표시) 엔진은 저장 버전으로 계산 — 초안을 저장된 계획으로 보이지 않는다 | db+browser | PASS | PASS |
| R09 | 1회 경험 ≠ 2지문 계획 완료 — lifecycle 4칸(기출 근거 자세히)도 적용 1/2 · 마침 아님 | db+browser | PASS | PASS |
| R10 | 수행 뒤에도 저장 PLAN 은 자동으로 덮이지 않는다(버전 1 그대로) | db | PASS | PASS |
| R11 | 적용 계획량 1 로 조정(v2) → 운영 단계가 다시 확인으로 · 성취 그대로(조정 ≠ 숙달) | db+browser | PASS | PASS |
| R12 | v1 명시 복원 → v3 · restored_from 1 · 지도는 다시 적용 1/2 | db+browser | PASS | PASS |
| R13 | TRANSFER 2회(다른 문항) → 다시 확인 · 다음 = 안 본 확인 문항 · lifecycle 도 CHECK | db+browser | PASS | PASS |
| R14 | 미노출 CHECK 2 정답 — 두 문항이 첫 시도 원장에 정답으로 · 직접 확인 재판정(resolved) · R5 요구가 REPAIR 아님 · 성취 resolved | db+browser | PASS | PASS |
| R15 | 재계산 뒤 Workspace 행 · 팝업 · 모달 · PLAN 이 같은 다음 행동(또는 같이 없음) | db+browser | PASS | PASS |
| R16 | PLAN 저장 이력은 수행으로 바뀌지 않는다(3버전 유지) · 새 단계는 화면 계산(저장은 명시적으로만) | db | PASS | PASS |
| R17 | 과거 asof — 학습 시작 링크 0 | browser | PASS | PASS |
| R19 | 페이지 가로 넘침 0 | browser | PASS | PASS |

**1440 · 1280 각각 20 PASS · 0 FAIL** · 계정 각 1 생성 → 삭제 · 부재 확인 1/1. [1440](./evidence/lm-g1-2-20261016/vertical-1440/results.json) · [1280](./evidence/lm-g1-2-20261016/vertical-1280/results.json) · 화면(단계마다 드로어 · lifecycle 시트 · PLAN).

결과 파일의 `sha` 는 실행 당시 HEAD(base `7e7b51ab7`) — 이 브랜치 변경은 그때 **커밋 전 작업 트리**에 있었고, 같은 내용을 이 PR 첫 커밋으로 올렸다(코드 변경 없이 커밋만). Codex 재실행은 PR HEAD 에서 한다.

흐름 요약(1440): 확인 단계 · 같은 확인 문항(2022-20) → FIND 2 오답(원장 task_attempts 2 · first_attempts 2 · phase practice · 수신 시각) → REPAIR · 막힌 문항 → REPAIR 2 오답(수행 2 · 여전히 REPAIR) → 정답 1(TRANSFER 0/2 · M2609#23) → PLAN v1 · 재전송 reused · 키 재사용 409 · 낡은 버전 409 → 저장 실패 주입(오류 · 미저장 · v1 그대로) → TRANSFER 1(1/2 · 다음 2026#23 · 4칸도 1/2 · 마침 아님) → 저장 PLAN 덮이지 않음 → 계획량 1 조정 v2(다시 확인 · 성취 그대로) → v1 복원 v3(restored_from 1 · 다시 1/2) → TRANSFER 2(다시 확인 · lifecycle CHECK) → 미노출 CHECK 2 정답(resolved · 근거 「다시 확인 통과」 · 요구 유지/다시 확인) → 모든 표면 같은 다음 행동 · PLAN 3버전 그대로 → 과거 asof 학습 링크 0.

## 5. 회귀

| 묶음 | 결과 |
|---|---|
| LM-G1.1 T1 `e2e-lm-g1-1` | 9/0 |
| LM-W1 통합 화면 `e2e-map-workspace`(1280 · 1440 · 레일) | 36/0 |
| 복귀 `e2e-map-return`(저장 PLAN v1 · v2 · 목표 · 남의 UUID · 과거) | 7/0 |
| 기출 해부 `e2e-map-study` · R5 공급 `e2e-map-supply` | 6/0 · 6/0 |
| 근접 해설 `e2e-lm-g1-2-timing` | 2/0 |
| 단위 | `lib/csat` · `components/csat` · `lib/learner` · `lib/knowledge` 208 파일 · **2,457 테스트 실패 0**(25 파일 단위 새 프로세스 13 묶음 — 한 프로세스 전체 실행은 이 기계 메모리 부족으로 작업자가 죽어 PASS 로 세지 않고 다시 나눠 돌림) · tsc · lint 오류 0 · `check.mjs` 15/15 |

LM-G1.1 원장(`lm-g1/` · `lm-g1-1/`)은 변경 없음.

## 6. 상태 요약

| 항목 | 상태 |
|---|---|
| TRANSFER 계약 · 반례 | PASS(①) · 실제 1/2 · 조정 1 · 복원 · 2/2(②③) |
| 근접 해설 반례 A–H | PASS(① 현행 고정) · C(②③ 실제 보류 · 안내) |
| 정책 v2(C2 · G) | **BLOCKED_APPROVAL** — 판정 버전 변경 · 실측 근거 0 |
| R5 수직(목표 → FIND → REPAIR → TRANSFER → CHECK → 재계산) | ②③ 표 참조 |
| PLAN v1 · 멱등 · 키 재사용 409 · 낡은 버전 409 · 조정 v2 · 복원 v3 · 실패 표시 | ②③ 표 참조 |
| 실존 타인 Workspace/PLAN 접근 | 이번 실행 **NOT_TESTED** — PR #272 Codex A/B 5/5(실존 UUID · GET/쓰기/복귀) 증거를 재사용, 코드 경로 변경 없음 |
| 오래된 응답의 최신 선택 덮어쓰기 · 원자 저장 부분 실패 · raw 조회 한도 경계 | **NOT_TESTED**(이번 범위 밖 — LM-G1.3a 로 이월) |
| 학습 효과 | **NOT_CLAIMED** |

## 7. 재사용 · 새로 고친 것

- 재사용(변경 없음): recordItemTaskAttempt · submitPractice · writer · loadMapPage · loadFindAttempts · crossSessionHelp · skillDiagnosis · ranksOf · plan-store · plan-commit RPC · PlanSection(초안 · 버전 · 충돌) · LM-W1 화면.
- 고친 것: `lifecycle-evidence`(TransferContract · transferTarget · transferFinished · nextLifecycleAction 이 진행/계획량을 받음) · `v4/plan`(transferDoneOf · transferPlanned · PlanOpts · stageNow/taskPlan 계획량) · `v4/compose`(savedTransferOf) · `v4/as-is`(timingHeld) · `v62/graph`(now.timingHeld) · `curriculum` · `SkillPrescription` · `StepSheet`(적용 진행 표시) · `TaskInspector` · `TaskPopup`(보류 안내 한 줄).

## 8. LM-G1.3a 착수 가능 여부

가능 — 이 수직 경로(저장 → 재계산 → 다음 행동 → PLAN 버전)를 R5 에서 실측했다. 이월: 정책 v2(C2 · G) 승인 여부 · 오래된 응답 덮어쓰기 · 부분 실패 · 조회 한도 경계 · 타인 접근 재실행 · 다른 TASK 로의 확장 · 학습 효과는 별도.


## 독립 검토 수정 revision (2026-10-16, T2 최종 판정 전)

위 최초 제출 결과는 보존한다. 고정 HEAD e32609ccf44b077c4d759424fc1e08a55cd5ac12의 새 1280/1440 실행은 각각20/20이다.
추가 반례에서 문항 ID와 지문 단위의 차이, 자료 감소에 따른 운영량 자동 축소, 1,000행 절단, 만료된 회차의 보류 집계, 다른 단계 저장량의 화면 덮어쓰기를 확인했다.
독립 수정은 기존 csat_items.passage의 canonical JSON hash를 수행·후보에 결속한다. 같은 지문의 형제 문항은 한 지문으로 세고 다음 링크에서도 건너뛴다. 식별 원문이 없으면 지문 수를 증명하지 않는다.
기본2 및 저장 운영량은 공급 부족으로 자동 축소하지 않는다. 학습자가 명시 저장한1은 그대로 운영량1이다. 자료0은 미확정이며 숙달·능력으로 승격하지 않는다.
수행 조회는 본인/TASK 범위를 유지한 ID 커서 전체 페이지 조회로 바꾼다. 후속 페이지 오류는 부분 성공으로 반환하지 않는다.
보류 표시는 기존120일 회차 시작과 해소 시점을 사용한다. 2분 노출 정책·동일 공유지문의 노출 정책·DB/RPC/RLS는 변경하지 않는다.
다른 단계의 저장량은 현재 단계에 덮지 않는다. 원본 E2E 계정 정리도 명시404/정식 부재 코드만 인정하고 장애를 성공으로 숨기지 않는다.
독립 최종 판정과 근거는 후속 검토 문서에 별도 기록한다. 이 절 자체가 T2 ACCEPT나 학습 효과 검증은 아니다.

후속 독립 반례에서는 늦은 PLAN 응답의 새 초안 삭제, CHECK 단계 저장 뒤 전이 운영량 소실, 지원 Workspace의 중심 TASK 운영량 덮어쓰기를 추가 확인했다. 인스턴스·키·요청·편집 세대 가드와 본인/Workspace 전체 변경·복원 이력의 정책 재생으로 수정했다. 화면 이력은20개를 유지한다. 계획2·가용1의 확정은 기존 DB 계약상 허용하지 않으며, 자료 대기로 표시하고 명시 조정1만 새로 확정할 수 있다. DB/RPC 검증을 완화하지 않았다.

최종 목적 검토의 후속 반례도 최초 결과와 분리했다. 성공 응답 뒤 추가 편집을 보존하는 것만으로는 충분하지 않아 실제 후속 저장409를 재현했다. 정확한 사용자/목표/Workspace/저장 버전의 성공 응답만 새 편집기에 전달하고, 같은 단계의 초안을 확인된 버전으로 옮겨 다음 저장을 허용한다. 이전 단계 복원 payload가 재생된 TRANSFER 운영량을 다시 덮지 않도록 표시도 정책 재생값을 사용한다. 이는 로컬 초안 복구이며 서버의 권한·기대 버전·멱등 검증을 우회하지 않는다.
