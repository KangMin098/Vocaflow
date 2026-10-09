# WF-S7 — 적응형 다중 턴 사용자 목표 (2026-10-09)

## 선행: WF-S6 마감 상태

- 기능 검증 완료(WORKFLOW_READY · HUMAN_IN_THE_LOOP). PR #161 은 main 병합 사용자 확인 대기.
- Stop 훅 최종 리뷰 0649a30e0: 원문은 깨끗(「No remaining P0 or P1」)했으나 판독 실패 → 판독 수정(c50dfeb7d). 재시도 때 Codex 사용량 한도 → 기록은 UNKNOWN(통과 아님). 한도 해제 뒤 다음 Stop 에서 재시도.

## 재사용 · 신규

- 재사용: planning 요청/응답(+thread 필드, 옛 형식 호환) · DECISION_LOG 사용자 APPROVED · TASK_QUEUE·잠금·journal·복구 · 오케스트레이터 재작업 루프 · Stop 훅 판정(require_review_pass).
- 신규: `lib/usergoals.mjs`(목표·thread·설계 버전·승인 범위·라우터·원자적 인수·프로필·예산) · `state/USER_GOALS.json` · `vfc ugoal …` · 선정 게이트·설계 쟁점 분기(orchestrator) · startTask/completeTask 사용자 목표 게이트 · goal-check 재검증 제외 · `goal-orchestrator --help` 가 실행을 시작하던 결함 수정.

## 실행 모드

ChatGPT-first(vfc-goal 파일) · Claude-first(초안 또는 설계 요청) · USER_GOAL(활성 목표 우선) · PLATFORM_AUTO(전체) · 프로필 FAST/BALANCED/DEEP/CRITICAL.

## 시나리오 결과

| | 시나리오 | 방식 | 결과 |
|---|---|---|---|
| A | ChatGPT v1 → 승인 → 구현 → Codex PASS → 수용 | 가짜 에이전트 + 모의 ChatGPT 파일 | PASS |
| B | v1 → Claude 설계 충돌 → 재질의 → v2 → 승인 → 자동 재개 → 검증 | 〃 | PASS (+B2 바뀐 기준은 옛 번호로 안 덮음) |
| C | Claude-first DEEP → 설계 요청 → 인수 → 승인 → 초안 작업 자동 생성 | 〃 | PASS |
| D | Codex 코드 결함 → Claude 수정 → 재리뷰(ChatGPT 왕복 0) / D2 Codex 설계 지적 → 재질의 | 〃 | PASS |
| E | 응답 정상 · DB 승인 없음 → 승인 대기 · DB 작업 거부 | 〃 | PASS |
| F | 활성 목표 대기 → 다른 목표 진행 → 응답·승인 후 활성 목표 우선 복귀 | 〃 | PASS |
| G | 섞인 응답 거부 · 중복 재적용 없음 · 복사 중 파일 무시 | 〃 | PASS |
| H | 설계 계약 변경 → 이전 완료 재검증 · 옛 작업 선정 제외 · 완료 위장 거부 | 〃 | PASS |
| 실 | Claude-first 등록 → 실제 Claude 구현 → 실제 Codex APPROVE → GOAL_ACCEPTED | **격리 실증**(샌드박스 VFC_ROOT · worktree `feat/wf7-ug-sandbox` 로컬 커밋 61ff72bac · 승인은 테스트 픽스처) | 297초 · $0.65 · `WF-S7-sandbox-real-run.json` |
| 실 | 실제 상태에 UG-0001 등록(Claude 초안) → APPROVAL_REQUIRED · 오케스트레이터 선정 0 | 실제 상태 | 사용자 승인 대기 |

ChatGPT 구간은 전부 **모의 파일**이다. 실제 ChatGPT 웹 왕복은 이번에 하지 않았다(사람 필요) — 자동 연동 성공으로 기록하지 않는다.

## 테스트 · 리뷰

- AI-Control 89/89 (기존 WF-S5·S6 회귀 포함). 변이 검사: thread 대조·활성 우선·재검증·승인 토큰 경계를 각각 끄면 해당 테스트 실패.
- Codex 실제 독립 리뷰 r1: P1 5 · P2 10 → 반영(P2 1건 한계로 남김). r2: P1 2 · P2 5 → P1 2·P2 3 반영, P2 2건 한계로 문서화(`docs/USER_GOALS.md` 한계).

## 남은 제약

- ChatGPT 왕복은 사람이 파일을 옮긴다(HUMAN_IN_THE_LOOP). 작업 분해는 사람·대화형 Claude.
- 설계·DB 승인은 사용자만. UG-0001 은 `decision add … 「UG-0001@v1」` → `ugoal approve` 를 기다린다.
- 샌드박스 커밋 61ff72bac 은 push 하지 않았다(픽스처 승인으로 만든 것).
