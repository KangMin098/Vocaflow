# WF-S4 — ChatGPT + Claude Code + Codex 실제 협업 연결 · 완료 판정 (2026-10-09)

## 완료 기준 대조 (사용자 지시 §10)

| # | 기준 | 결과 | 근거 |
|---|---|---|---|
| 1 | PR #158 처리 | ✅ main 병합 `bc7cd0340` | DL-0011 · review.mjs NO_FINDINGS · check.mjs 10/10 · CI pass(단 e2e 건너뜀) |
| 2 | 목표 정본 공통 참조 | ✅ main `AGENTS.md` 15행 · 정본 단일 사본 `ai-control:goals/` | `git show origin/main:AGENTS.md` |
| 3 | ChatGPT 연결 실측 | ✅ 웹·Work·데스크톱 판정 | `docs/CHATGPT_CONNECTION.md` — 저장소 PUBLIC · 데스크톱 앱 미설치 · 사람이 옮기는 파일 교환 채택 |
| 4 | 기획 요청 생성 | ✅ REQ-20261009-001(PLAN-0001 · kind=plan · T-0006) | `planning/archive/REQ-20261009-001.md` + 첨부 7(sha256) |
| 5 | 기획 결과 인수 | ✅ PROPOSED 로만 · 정규화 1건 기록 | DL-0014~0019 · 원문 `planning/archive/REQ-20261009-001.response.md`(무수정) |
| 6 | Claude 구현 | ✅ `cfc1833b9` + `6165b7160` | `verification/reports/T-0006-claude-run.md` |
| 7 | Codex 독립 리뷰 | ✅ r1 APPROVE(+P2 2) · r2 APPROVE | `verification/reviews/T-0006-codex-r1.md` · `-r2.md` |
| 8 | 결함 수정·검증 | ✅ P2 2건 수정 · 변이 검사로 회귀가 결함을 잡는 것 확인 | `EV-T-0006-r2-mutation.md` |
| 9 | 테스트 통과 | ✅ 관련 60/60 skip 0 · typecheck · lint · 관리자 영역 709 pass/19 skip(무관 DB 통합) · vfc 35/35 | `verification/tests/EV-T-0006-r2-*` |
| 10 | 공유 상태 갱신 | ✅ T-0006 COMPLETED(리뷰어 independent-review) · GOAL_STATUS · DECISION_LOG | `vfc status` |
| 11 | 다른 세션 충돌 없음 | ✅ 새 worktree `Vocaflow-wf4-d102` 만 사용 · 잠금 획득/반납 2회 · 남의 잠금 해제 0 | `runtime/logs/events.jsonl` |
| 12 | 승인 없는 DB 쓰기 0 | ✅ SELECT 만(조사 2회) · 마이그레이션 diff 0 | `EV-T-0006-r2-no-db-change.md` |
| 13 | commit·push | ✅ ai-control · feat/qa-account-separation(PR 열림, 머지 안 함) | git log |
| 14 | 전체 목표 상태 재평가 | ✅ 아래 | |

## 목표 상태 재평가

| 구역 | 이전(WF-S3) | 지금 | 변경 근거 |
|---|---|---|---|
| L0–L3 목표 35 | FAIL 1 · UNKNOWN 34 | **FAIL 2 · UNKNOWN 33** | VG-L3-D1-02 → FAIL(AC1 미달 직접 확인 · 리텐션 분리는 진전) |
| VG-L3-D2-01 | FAIL | FAIL(근거 추가) | PR #158 CI e2e 도 건너뜀(run 37851615027) |
| 출시 게이트 7 | R0-DEPLOY FAIL · 나머지 UNKNOWN | 동일 | — |
| L4 템플릿 5 | (목표 상태에 없음) | instantiated 4 · not_instantiated 1(DELIVER) | 작업에서 파생 · PASS/FAIL 없음 |
| 작업 | READY 5 | READY 5 · COMPLETED 1(T-0006) | |

PASS 는 하나도 없다 — 직접 검증된 수용 기준 충족이 아직 없다. VG-L3-D1-02 를 PASS 로 올리지 않았다(사용자 지시).

## 수동(Human-in-the-loop) 단계 — 이번에 실제로 필요했던 것

1. 사용자가 요청서 + 첨부 7개를 ChatGPT 에 업로드
2. 사용자가 답 전체를 `planning/responses/` 에 저장
3. 사용자 메시지로 T-0006 범위 승인(DL-0020)
**완전 무인 연동이 아니다.** 나머지(검증·인수·구현·리뷰·상태 갱신·커밋)는 Claude Code 가 수행했고 Codex 는 CLI(read-only)로 호출됐다.

## 발견된 프로토콜 사실

- ChatGPT 가 제안 1 에 `requires_user_approval:false` 를 넣었다 → 검증기가 거부 → 엄격화 정규화(`--normalize-approval`)로 인수하고 기록. 요청서 지시만으로는 이 필드 규칙이 지켜지지 않는다 — WF-S5 에서 요청서 문구 강화 후보.
- Codex 는 read-only 샌드박스라 테스트를 직접 돌리지 못한다 — 테스트 결과는 구현 쪽 로그에 의존하고, Codex 는 메모리 검증으로 보완했다.
