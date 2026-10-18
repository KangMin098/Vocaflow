# LM-G1.1 — PR #272 독립 수용 기록

2026-10-15 · Codex. 대상은 R5의 다음 행동과 실행 링크를 일치시키는 T1이다. 실제 학습 효과 또는 전체 제품 완성을 수용하는 기록이 아니다. 최종 검증 결과와 병합 상태는 [PR #272](https://github.com/KangMin098/Vocaflow/pull/272)의 최신 HEAD·CI에 결속한다.

## 기준과 보존

- 고정 제출 HEAD `4a5d2e98f6b677b3ec21c4b38e5bf2c6dd3b0017`, 기준 main `914c16096aa23c8cff81a64c8f84c3450d727edf`.
- 별도 worktree `Vocaflow-lm-g1-1-review`, 실제 Next dev/Chromium, PC 1280×900·1440×900. 포트 3000의 다른 세션을 건드리지 않고 3007에서 검증했다.
- [정본](../../csat-learner/v62/LEARNING_MAP_V6_2_CANON.md), [최초 감사](../../csat-learner/v62/GOAL_GAP_AUDIT.md), [로드맵](../../csat-learner/v62/TARGET_COMPLETION_ROADMAP.md), [수직 수용](../../csat-learner/v62/R5_VERTICAL_ACCEPTANCE.md), [LM-W1](../../csat-learner/v62/LM-W1_MAP_WORKSPACE.md), [제출 설계](../../csat-learner/v62/LM-G1_1_R5_STAGE_READINESS.md)를 기준으로 삼았다.
- 최초 G02/G03 및 최초 테스트 원장, Claude revision 2를 덮지 않았다. 같은 fixture의 독립 재계산은 [revision 3](probes-r3.json)이다. 파일 hash는 [manifest](manifest.json)에 보존한다.
- 합성 계정의 기존 API 수행·계획 저장과 종료 후 해당 소유 계정 정리를 실행했다. 기존 학생 기록·DB 스키마·RPC·RLS·공개 콘텐츠를 변경하지 않았다. 실제 학생 능력의 표본이나 효과 증거가 아니다.

## G02 및 공통 기준 검토

| 검토 항목 | 확인 결과 |
|---|---|
| FIND 2 실패 → REPAIR 2 실패 | 수행 문항 수 2 유지, 성공 근거 없음, PLAN/lifecycle 모두 repair, 실패한 i1 재시도 링크 유지 |
| repairWindow | 기존 lifecycle의 회차·blocked·since 분기를 추출했다. verifiedAt 없으면 null, still_needed의 마지막 실패가 더 늦으면 그 이후/막힌 CHECK 문항만 사용 |
| resolved | 기존 회차 안의 성공을 유지하는 예외를 보존. 새 REPAIR를 강제하지 않음 |
| repairAttempts | 같은 과제 키·막힌 item·strictly after since. 시각 정렬. 중복은 성공 횟수/양을 부풀리는 근거로 쓰지 않음 |
| 성공 | `isCorrect === true` 하나가 기존 충분 조건. false/null/누락, 다른 과제/문항, 이전 회차·동률 시각은 성공 아님 |
| 로더 전달 | `loadLifecycleActivity`가 본인 `learning_task_attempts.is_correct`를 읽고 `composeV4`가 같은 activity를 PLAN에 전달. 로더 변경 없음 |
| 양·도달 | doneOf/계획량/achievement 계산을 이번 수정이 바꾸지 않음. 수행 2/2는 성공·숙달이 아님. 재확인 실패 뒤 새 성공 창과, 기존 verifiedAt 기준 수행량은 별개 |
| CHECK/120일 | skill-diagnosis의 상태 알고리즘·상수는 변경 없음. 문구에서 근거 없는 ‘연습하고’를 제거한 변경만 존재 |

새 성공 기준을 더 엄격하게 만들지 않았다. 남은 모든 막힌 문항을 맞혀야 한다거나 독립 재시도만 REPAIR로 인정한다는 조건을 추가하지 않았다. lifecycle은 원래 안내·해설 뒤 바로잡기도 인정한다. 원장의 시도 정오를 소급 수정하지 않았다.

## 실행 URL 반증과 보강

고정 HEAD에서 재현한 추가 결함 **I01 / P2**: R5의 repair 성공 뒤 전이 후보 x1/x2가 있는데, 같은 학생이 **다른 실제 TASK 키 `evidence-locate`**로 동일 item에 남긴 `phase=transfer` 기록이 있으면, R5 수행량은 0인데 `stageLink`가 x1/x2를 모두 완료로 제외해 next=null이 된다. `doneOf`는 TASK를 필터하지만 링크의 did 집합은 필터하지 않는 것이 원인이다. [고정 HEAD의 실패](pinned-unit.json)를 보존했다. 이 반례는 합성 함수 입력으로 재현한 코드 결함이며, 실제 학생에게 발생했다는 빈도 주장은 하지 않는다.

최소 수정: `v4/plan.ts::stageLink`의 did 범위를 기존 doneOf와 동일한 TASK 키/전이 phase 범위로 제한한다. 다른 TASK의 수행은 링크를 소진하지 않고, 같은 TASK의 완료 문항은 제외한다. 일반 CI에도 T21/T22 회귀를 추가했다. 화면·분류·계획량·새 정책을 만들지 않았다. 원래 `repairGate`/`repairWindow`는 추가 수정하지 않았다.

`taskPlan.next`의 `need.executable` 우선 경로도 검토했다. 현재 `toBeMap`은 CONFIRM/MAINTAIN에서만 이를 만들고 REPAIR/TRANSFER에는 null을 만든다. 실제 생성된 REPAIR need를 사용한 반례에서 우회가 없음을 검사했다. 불가능한 need 객체를 강제로 만들어 현 제품의 재현 결함이라고 세지 않았다. CONFIRM/MAINTAIN의 후보는 check.unseen과 현재 confirmLinks의 교집합이다.

| 금지 상황 | 검증 |
|---|---|
| 실패한 REPAIR만 존재 | repair 유지, 실제 실패 item 재시도 URL |
| 재시도 자료 없음 | repair + null. Workspace의 새 확인 문항으로 대체되지 않음 |
| 성공 준비 미충족 | transfer URL 없음. false/null/누락·다른 TASK 반례 |
| 적격 콘텐츠 없음 | confirmLinks가 비면 실행 URL 없음. loader의 held/fail-closed 분기 및 Workspace readiness 확인 |
| 과거 asof | 실제 팝업·드로어·모달·PLAN을 열어 모든 학습 시작 링크 0 확인 |
| 해설 노출 | 기존 study 회귀와 별도 관찰. 열람 자체를 독립 성공으로 처리하지 않음 |
| 실제 다른 학습자 Workspace | B가 기존 API로 저장한 실존 UUID로 A의 GET/쓰기/복귀를 검사. 타인 계획 노출 없음, 임의 workspaceId 쓰기 400, 현재 본인 계획으로 복귀 |

권한 검사는 [A/B 결과](evidence/workspace-boundary/results.json)에 보존했다. 직접 RPC 호출·RLS 변경 또는 모든 권한 공격의 완전성을 주장하지 않는다.

## 기존 테스트 세 건의 변경 타당성

`plan.test.ts` ②/③은 종전 ‘다시 풀면 진행’ 경로에 정오가 빠져 있었다. 성공 경로를 `isCorrect:true`로 명시하고, 별도 실패·null·누락 반례가 진행하지 못하는지 확인하는 방식이 원래 lifecycle 계약과 맞는다. 기존의 ‘모든 문항 재시도 횟수만으로 TRANSFER’ 기대는 보존해야 할 교육 계약이 아니었다.

`state-transitions.test.ts` F는 성취가 수행량으로 변경되지 않는다는 테스트다. 정답 REPAIR를 추가해 실제 TRANSFER 진행 경로를 구성해도 achievement가 그대로인지 검사하므로 원래 불변식을 유지한다. 날짜의 `2026-09-9`를 `2026-09-09`로 바꾼 것은 ISO 순서·파싱을 바로잡는 입력 정정이다. 성공을 보기 위해 임의로 시점을 앞뒤로 옮긴 변경이 아니다.

이 판단은 수정된 기대값끼리의 일치만으로 내리지 않았다. 수정 전 독립 P2 실패, 기존 lifecycle 성공 정의, 실제 API의 실패/정답 기록과 화면 값을 별도로 대조했다.

## 실제 브라우저와 LM-W1 보존

상단 행동이 실제 존재하도록 적격 시험 M2409와 목표를 기존 API로 입력했다. R5 첫 독립 확인 두 번 실패, 실패 REPAIR 두 번, 정답 REPAIR를 순서대로 제출했다. 기존 테스트의 ‘repair가 아니면 성공’ 단정을 강화하여 **정답 후 transfer**를 명시하고, 실제 pathname과 전이 `item` 파라미터까지 비교했다.

- 1280: [결과](evidence/accepted-1280/results.json), [실패 후 PLAN](evidence/accepted-1280/06-T02-plan.png).
- 1440: [결과](evidence/accepted-1440/results.json), [성공 후 모달](evidence/accepted-1440/08-T04-modal.png).
- 지도 R5/상단·행·빠른 팝업·드로어·상세 모달·PLAN은 같은 TASK/회차에서 동일 단계와 실행 대상을 사용했다. 실패 직후 실행은 `/csat/item/2022-20?...check=1...`, 성공 뒤에는 `/csat/practice/claim-support?item=M2609%2323`이었다. 이는 실행 당시 적격 후보이며 영구 고정 추천이 아니다.
- 보강 제품 변경은 PLAN 함수와 회귀 테스트뿐이다. LM-W1 컴포넌트·CSS는 기준 main과 동일하다. 별도 새 화면·카드·디자인을 추가하지 않았다. 실제 캡처를 열어 모달/드로어 내부 스크롤·정보 위계·화면 내 배치를 확인했다. 3B 원본 전체를 재조사했다고 하지 않는다.

### 실행 순서가 드러낸 기존 노출 경계

초기 독립 변형은 해설 복귀를 정답 REPAIR보다 먼저 실행했다. 따뜻한 서버에서 첫 FIND와 해설 열람이 2분 이내였고, 기존 `crossSessionHelp`가 순서를 uncertain으로 보류하면서 이후 화면은 transfer가 아닌 check가 됐다. 해당 helper/loader는 이번 PR에서 변경하지 않았다. 더 오래 걸린 최초 제출 시험에서는 이 조건이 나타나지 않았다.

이는 새 단계 규칙의 성공 증거로 쓸 수 없다. [관찰](evidence/final-1280/results.json)을 보존하고, 최종 검증은 **해설 열람 전에 정답→TRANSFER를 검사한 뒤**, 저장해 둔 실패 문항 링크로 복귀/노출 경계를 검사했다. 기존 2분 정책을 이 PR에서 완화하거나 옛 첫 수행을 독립이라고 강제하지 않았다. 아래 LM-G1.2 선행 검증에 포함한다.

## LM-G1.2 선행 계약과 이번 수용의 한계

| 경계 | 현행 사실 | 후속 인수 조건 |
|---|---|---|
| TRANSFER 1 vs 2 | lifecycle은 경험 1회 후 CHECK를 안내할 수 있고 PLAN은 운영 계획량 2의 남은 문항을 안내한다. 실제 다음 행동 차이가 존재한다 | 1회를 2회 완료로 표시하지 않기. 경험·운영 계획량·학습자 조정의 목적과 다음 행동 우선 출처를 별도 결정하고 버전별 반례를 고정 |
| 근접 해설 노출 | 2분 이내 순서 uncertain이면 이후 읽기에서 독립 근거가 보류될 수 있음 | 원자 제출 시각/서버 수신/열람 이력을 함께 고정해 수행 전후 MAP·PLAN·저장 계획 복귀를 검증. 상태가 변한 근거를 설명할 것 |
| 저장 환류 | 이번 stage와 링크 수용은 PLAN 새 버전 자동 확정 또는 모든 이력 복원이 아님 | attempt 원자 저장→본인 loader→compose/rank→명시 PLAN commit/버전 충돌/멱등/실패 복구를 수직 검증 |
| 효과·지원 | 합성 계정/현재 R5 콘텐츠 범위 | V2/S5·Factory 실제 연결·교육 효과를 이번 결과로 완료 처리하지 않음 |

TRANSFER 정책을 이번 PR에서 임의 통일하지 않았다. T1은 실패 REPAIR를 완료량으로 넘어가던 결함과 실행 링크의 일관성 범위이며, legacy의 1회 경험과 PLAN의 2회 계획량을 동일 충분성으로 승인하는 게이트가 아니다. LM-G1.2는 위 선행 계약을 명시하고 착수할 수 있다.

## 재현·실행 원장

```powershell
pnpm --filter web exec vitest run --config ../../scripts/research/lm-g1-1-independent/vitest.config.mjs
node --tls-max-v1.2 --env-file=<승인된 환경 파일> scripts/research/lm-g1-1-independent/browser.mjs --base http://localhost:3007 --width 1280 --evidence <새 디렉터리>
node --tls-max-v1.2 --env-file=<승인된 환경 파일> scripts/research/lm-g1-1-independent/browser.mjs --base http://localhost:3007 --width 1440 --evidence <새 디렉터리>
```

테스트 준비 단계의 출력 경로 오류, 중단된 실행, 메모리 부족/worker 종료 오류는 수용 PASS로 세지 않는다. 중단된 소유 합성 계정은 실행 시각·전용 주소 형식을 대조해 정리했다. 최종 브라우저 실행은 소유 UUID를 ignored 실행 원장에 먼저 보관하고 정리 결과를 공개 결과 JSON에 남긴다. 소유 UUID/인증값은 커밋하지 않는다.

## 최종 독립 판정 — ACCEPT (T1 범위)

P0/P1 발견 없음. 추가 P2 I01은 수정·같은 반례 재검증으로 종료했다. 별도 디자인 P2/P3를 발견하지 않았다. 최초 G02 결함을 수정한 Claude 변경은 정당하며, 아래 실행 결과로 T1을 수용한다. 1회 경험/2회 운영량 및 노출 순서 정책은 위 후속 계약대로 유지한다.

| 검사 | 최종 결과 |
|---|---|
| 고정 HEAD 독립 반례 | 11개 중 링크 소진 1 FAIL 보존; 현재 코드의 실패로 혼합하지 않음 |
| 수정본 독립 반례·G02/G03 revision 3 | 15/15 PASS |
| PLAN/lifecycle/skill/rank/coverage/저장·복귀·지도 컴포넌트 단위 | 722/722 PASS, skip 0; 단일 fork로 오류 없이 재실행 |
| 실제 단계/링크 브라우저 | 1280 9/9 · 1440 9/9 PASS |
| 실존 타인 Workspace | 5/5 PASS, 소유 합성 계정 정리 |
| 기존 LM-W1 / MAP 복귀 / 해부 / 공급 | 36/36 · 7/7 · 6/6 · 6/6 PASS |
| TypeScript / 대상 lint / diff 공백 | PASS |
| 최신 PR 필수 CI / 병합 | PR 원장의 최종 HEAD 결과를 별도 확인한 뒤 safe-merge; 로컬 검사로 대체하지 않음 |

[최종 단위](regression-unit-final.json) · [독립 반례](revised-unit-final.json) · [기존 브라우저 회귀](regressions.json). 원본 R은 E2의 제한된 PLAN v1/v2 복귀이며 R5 전체 원자 저장 환류를 검증한 것으로 확대하지 않는다. 이번 소유 계정·임시 서버는 실제 학습자/운영 실증이 아니다.

**LM-G1.2 착수 가능:** 이번 화면과 loader/writer/PLAN 저장 경로를 재사용하며, TRANSFER 다음 행동 우선 출처와 근접 노출/원자 저장의 선행 계약을 고정해야 한다. 새로운 DB 승인이 필요한 구현은 후속 별도 범위다. 이번 PR 수용을 DB 승인 대기로 전역 차단하지 않는다.


### 추가 목적 리뷰의 검증 도구 보강

제품 P2 I01 외에 도구 P2 두 건을 고쳤다. 브라우저 단정 실패/잔존 계정이면 종료 코드를 1로 하고, 새 체크아웃에서도 ignored local 로그 폴더를 먼저 만든다. 성공 결과·입력·화면 단정·제품 코드는 바꾸지 않았다. manifest는 실행 당시 protocol hash와 보강 후 현재 hash를 구분한다. 이 후처리 보강을 제품 브라우저 시나리오를 새로 실행한 것으로 주장하지 않는다.


계정 정리의 조회 오류를 0으로 삼키는 도구 P2도 추가로 종료했다. 명시적인 `404/user_not_found`만 부재로 인정하고, 삭제 실패·조회 실패·빈 성공 응답·불명확한 404는 실패/미확인으로 기록한다. 오류 주입 5/5, 실제 종료문/폴더 생성 4/4를 [도구 검증](harness-check.json)에 보존했다. 실행 때 기록한 소유 합성 계정 6개는 읽기 전용 admin 조회에서 모두 실제 부재를 [재확인](absence-confirmation.json)했다(잔존0·미확인0). 첫 리뷰 도구2건과 이 추가1건을 합쳐 도구 P2는3건이며 모두 종료했다. 제품 P2 I01과 분리한다.


A/B 권한 검사 도구도 첫 삭제 오류에서 중단되지 않게 같은 정리 함수를 재사용했다. 첫 계정 삭제 실패 뒤에도 두 번째 삭제·조회가 실행됨을 추가 오류 주입으로 확인했다. 최종 도구 오류 주입6/6 + 종료/폴더 생성4/4이며, 제품 P2 1건과 검증 도구 P2 4건은 모두 종료했다. 도구 보강은 기존 성공 실행의 입력·화면 단정을 바꾸지 않는다.
