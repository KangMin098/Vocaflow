# WF-S5 — 목표 중심 자동 오케스트레이터 · 완료 판정 (2026-10-09)

## 완료 조건 대조 (지시 §15)

| 조건 | 결과 | 근거 |
|---|---|---|
| 목표 검사기 작동 | ✅ 정본 40목표·35 판정 대상의 수용 기준별 판정 · CI 로그 판독 | `bin/goal-check.mjs` · `verification/goal-check/GC-*.json` |
| 다음 작업 자동 선정 | ✅ 범주표 + 이유 · 실행 불가 사유 기록 | `bin/goal-priority.mjs` · `config/priority.json` |
| Claude CLI 실행 | ✅ 실제 1건(T-0008) — 3분 22초 · $0.85 | `verification/reports/WF-S5-first-run.json` |
| Codex CLI 독립 검증 | ✅ 실제 2건(T-0007 수동 호출 · T-0008 자동) APPROVE · ran_tests=false 를 그대로 기록 | `verification/reviews/T-0007-codex-r1.md` · `T-0008-orch-*-r1.md` |
| 실제 결함 수정 루프 | ✅ 가짜 에이전트로 P1→수정→재리뷰·오탐·상한 검증(실제 실행에서는 P0/P1 이 나오지 않아 루프가 돌 일이 없었다) | `tests/orchestrator.test.mjs` 7·8·13 |
| ChatGPT 요청 조건부 생성 | ✅ flags/설계 실패 2회일 때만 · 해당 작업만 WAITING_CHATGPT · 독립 작업 계속 | 테스트 §9 |
| 소유권·승인 차단 | ✅ owner·worktree·잠금·승인·DB 경로·ChatGPT 충돌 | `lib/feasibility.mjs` · 테스트 5·6 |
| 상태 갱신 | ✅ journal 트랜잭션 · 변경 이유·이전 상태 기록 | ORCHESTRATOR.json · GOAL_STATUS history |
| 재시작·복구 | ✅ 실행 중 SIGKILL → 다음 실행이 aborted 처리·작업 되살려 완료 | 테스트 10 |
| 실제 작업 1건 검증 | ✅ T-0008 COMPLETED(검증 커밋 b3c55933a) → PR #160 | 위 |
| 문서화·commit·push | ✅ `docs/ORCHESTRATOR.md` · ai-control 커밋들 | git log |

## 이 단계에서 드러나 고친 결함 (실측)

| 출처 | 결함 | 처리 |
|---|---|---|
| PR #159 CI | T-0006 이 PR head CI(verify) 실패를 확인하지 않고 COMPLETED — OFFSET 예산 초과 | DL-0022 · T-0007 로 수정(예산 무수정) · PR #159 병합 |
| CI 판독 | 「건너뜀」 표식이 너무 넓어 verify 를 job 전체 건너뜀으로 오판 | `::notice::` 만 job 건너뜀 · 나머지는 partial_skip_notes |
| 잠금 | 전체 테스트 실행 중 **죽은 마커 동시 회수 경쟁 실제 재현**(소유자 2) | epoch 마커 — 남의 마커를 지우는 경로 제거 · 10/10 |
| 건너뜀 규칙 | 범위 밖 DB 통합 skip 도 완료를 영구 차단 | skipped_files 가 작업 범위 밖일 때만 허용 |
| Stop 훅 Codex ×3 | 기획 재개 우회 · `**/` 경계 · 루트 경로 접두 우회 · 섞인 검증 커밋 | 모두 수정 + 회귀 |
| 첫 실제 실행 | Codex diff 기준 `undefined` · 목적 파일 미작성 | base 반환 · `.agent-goal.md` 자동 작성(사람 파일은 보존) |
| 승인 정책 | WF-S4 의 `--normalize-approval` 이 ChatGPT 값을 고쳐 받음 | 폐지 → approval_conflict 로 차단(DL-0023, 소급 판정 포함) |

## 목표 상태 (전·후)

| | 시작 | 끝 |
|---|---|---|
| L0–L3 목표 35 | FAIL 2 · UNKNOWN 33 | FAIL 2 · UNKNOWN 33 |
| VG-L3-D1-02 | FAIL | FAIL — PR #159 병합에도 유지(퍼널·KPI 미적용) |
| VG-L3-D2-01 | FAIL | FAIL — main 최신 ci.yml e2e(run 37860382335) 로그 「건너뜀」 자동 판독 |
| VG-L3-D1-01 | UNKNOWN | UNKNOWN — T-0008 은 partial 주장 |
| 작업 | READY 5 · COMPLETED 1 | READY 5 · COMPLETED 3(T-0006·0007·0008) |

PASS 0 — 직접 검증된 full 주장이 아직 없다. 숫자가 그대로인 것은 정직한 결과다: 이번 단계의 산출은 목표 달성이 아니라 그것을 재는 장치와 실행 경로다.

## 남은 위험·한계

- 실제 실행에서 Codex P0/P1 → Claude 수정 루프는 아직 한 번도 일어나지 않았다(가짜 에이전트로만 검증).
- Codex 비용은 CLI 가 보고하지 않아 시간 상한으로만 묶인다.
- 자동 실행 후보가 적다: 시드 작업 5개는 worktree 미지정·DB 범위·승인 필요로 실행 불가. 다음 단계에서 owner 별 worktree 를 지정해야 연속 실행이 가능하다.
- e2e 시크릿 미설정(DL-0004) — 그대로 FAIL. 가짜 시크릿을 만들지 않았다.
- 실사용 계정 분류 목록 미설정 → 실사용 0 유지(미분류 승격 없음).
- 첫 자동 실행은 단일 writer 로만. 다중 실행은 WF-S6 에서 epoch 잠금 위에서 검증한다.
