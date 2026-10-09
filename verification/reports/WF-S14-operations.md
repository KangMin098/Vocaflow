# WF-S14 — 목표 중심 연속 운영 (2026-10-10)

기준 0710f0268. 새 오케스트레이터 없음.

## 시작 전 감사(이미 있던 것 — 재구현 안 함)
목표 우선순위(priority.mjs + 실행 모드 tier) · Goal Alignment Gate · TASK_QUEUE/GOAL_STATUS + journal · 연속 루프(max-tasks·시간·비용·STOP) · 오케스트레이터 비정상 종료 복구(실제 SIGKILL 테스트 10·WF6b/c) · 단일 writer · owner/worktree 잠금 · Work Bridge watch(별도 명령) · Context Sync 캐시 · Codex 리뷰 루프 · 승인·수락(에이전트 표식) · perf 측정.

## 이번에 더한 것
- Work 브리지 tick 을 오케스트레이터 반복에 연결(게시·수집·인수·다음 게시 · 인수 재시도 · dry-run 무부작용 · 예산 안 대기).
- 세션 인계 handoffDeadSessions(죽은 세션만 · 깨끗한 worktree + start_head 동일일 때만 자동 재개 · owner 유지).
- 신뢰 승인 입력 vfc approve(대화형 터미널 + 확인 코드) · 강한 승인 4종은 tty 결정만.
- 수용 기준별 상태 criteria_status(덧붙이기).
- 같은 diff·같은 입력의 통과 리뷰 재사용.

## 시나리오(tests/operations.test.mjs · 로그 verification/ops/WF-S14-scenarios.txt) — 가짜 Claude/Codex/GitHub · 모의 Work 응답
| | 결과 |
|---|---|
| A 한 목표 승인 작업 2개 연속 | 한 실행에서 연속 완료 → GOAL_VERIFIED |
| B Work 응답 후 자동 재개 | 반복마다 게시·수집·인수(PROPOSED) → 사용자 승인 → 초안이 작업으로 → 다음 실행 완료 |
| C 세션 종료 후 인계 | 죽은 세션 작업만 회수·같은 owner 로 완료 · 살아 있는 세션 작업 그대로 · 미커밋 변경/세션 커밋이 있으면 BLOCKED+사유 |
| D A 승인 대기 중 B 실행 | X 가 Work 대기 중 Y 작업 완료 · 단일 in-flight(두 번째 요청은 수집 뒤 같은 tick 에 게시) |
| E 일부 충족 → 다음 미완료 | GOAL_PARTIAL(missing [1]) · 다음 선정 = 기준 1 작업 |
| F 승인 없는 DB·정본 변경 | DB 범위·재봉인·DB 쓰기 승인 비대화형 거부 · vfc approve 에이전트 거부 |
| G 중복 실행 | 동시 오케스트레이터 거부 · 같은 기준 중복 작업 거부 |
| H 수락 없이 USER_ACCEPTED 불가 | cli 결정 거부 → tty 승인 뒤에만 USER_ACCEPTED |

## 실제 상태 확인
- `verification/ops/WF-S14-real-dryrun.json`: 브리지·인계·복구 정상 동작, 실행 가능한 작업 0(남은 T-0001~0005 는 DB 접근·worktree 지정·승인 필요). ※ 이 dry-run 은 dry-run 브리지 차단(Codex P1) 수정 전에 찍혔다 — 대기 요청 0 이라 게시·인수는 일어나지 않았다(bridge-log 무변화).
- 수용 기준별 상태 실제 기록: VG-L3-A2-01-AC1 = UNKNOWN(작업 5개 완료 · partial claim 뿐) → 작업 완료 ≠ 기준 충족.
- 실제 목표: UG-0001 GOAL_VERIFIED(사용자 수락 대기) · UG-c8315ad8-0002 APPROVAL_REQUIRED(v2 PROPOSED) · 0003 PAUSED.
- 실제 `vfc approve` 를 이 에이전트에서 실행 → TRUST_REQUIRED(agent).

## Codex 독립 리뷰 3회
r1 P1 1(dry-run 브리지 부작용)·P2 3 → 수정 · r2 P1 1(죽은 세션 커밋이 리뷰 기준에서 빠짐)·P2 2 → 수정·회귀 · r3 P0/P1 0 · P2 2(줄 선 요청 게시 · tick dry-run 출력) → 수정. 전체 134/134.

## 실제 blocker
- 실제 제품 목표를 끝까지 돌릴 승인된 작업이 없다: UG-0002 설계 v2 승인(사용자) 대기 · UG-0001 최종 수락(사용자) 대기 · 플랫폼 T-0001~0005 는 DB 읽기·worktree·승인 필요.
- 신뢰 승인은 pty 우회를 막지 못한다(서명·PR 리뷰 채널이 다음 후보).
