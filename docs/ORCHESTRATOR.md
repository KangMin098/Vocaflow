# ORCHESTRATOR — 목표 중심 자동 실행기 (WF-S5)

목적은 AI 개발 자동화가 아니라 **Vocaflow 전체 플랫폼 목표(정본 v1.1.0)의 달성**이다. 오케스트레이터는 그 목표에서 아직 미달인 기준을 찾아, 실행 가능한 작업 하나를 Claude Code 로 구현하고 Codex 로 독립 검증한 뒤 목표 상태를 다시 계산한다.

## 구성

| 파일 | 역할 |
|---|---|
| `bin/goal-check.mjs` · `lib/goalcheck.mjs` | 정본 40목표의 **수용 기준(criterion_id)마다** 판정 → `verification/goal-check/GC-*.json` + GOAL_STATUS(바뀐 것만, 이전 상태·이유) |
| `bin/goal-priority.mjs` · `lib/priority.mjs` · `config/priority.json` | READY 작업 순위(범주 1~8 · 목표 상태 · R0 · 의존 수 · 작업 우선순위) + 이유. 최근 작업량은 입력이 아니다 |
| `lib/feasibility.mjs` | 실행 가능성: owner · worktree(바인딩·존재·브랜치) · 잠금 · 제품 `.agent-lock` · 범위 · 승인 · DB 경로 · 도구 · ChatGPT 충돌 · 선행 · 기획 필요 |
| `lib/agents.mjs` | Claude CLI(`claude.exe -p` · MCP 0 · 허용 도구 목록 · `--max-budget-usd`) · Codex CLI(`exec -s read-only`) · 리뷰/보고서 판독 |
| `lib/ci.mjs` | GitHub Actions 판독 — job 초록 ≠ 실행. `::notice::…건너뜀` = job 전체 건너뜀 · 일반 「건너뜀」 줄은 `partial_skip_notes` |
| `bin/goal-orchestrator.mjs` · `lib/orchestrator.mjs` | 지속 실행기 |

## 판정 규칙 (goal-check)

| 상태 | 조건 |
|---|---|
| PASS | COMPLETED 작업이 이 기준을 `claim:"full"` 로 주장 · 현재 run 증거 전부 pass(범위 밖 skip 만 허용) · 검증 커밋이 main 에 있고 **그 뒤 작업 범위 파일이 바뀌지 않음** |
| FAIL | `verification/` 의 사람·이전 증거로 기록된 FAIL(검사기 자기 보고서만 근거인 FAIL 은 다시 판정) · CI 판독이 실행 0 |
| BLOCKED | 이 기준을 겨냥한 작업이 BLOCKED |
| EXTERNAL_INPUT_REQUIRED | 이 목표에 열린 external_input 결정 |
| UNKNOWN | 그 밖 — 통과가 아니다 |

L0·L1 은 하위가 모두 PASS 여도 자동 PASS 하지 않는다. 상위 목표는 자식이 모두 PASS 일 때만 PASS 후보.
UNKNOWN→FAIL 은 `defect_discovered`(새 결함 발견)로, PASS→그 밖은 `pass_invalidated` 로 기록한다 — 후퇴가 아니라 발견이다.

## 한 반복

```
goal-check → goal-priority → feasibility(첫 실행 가능 작업)
  ├ 기획 필요(flags · 설계 실패 2회) → planning/requests/REQ-… 생성 · 작업 WAITING_CHATGPT · 다음 후보로
  └ start(잠금) → Claude 구현(보고서 · 커밋) → 범위 검사(밖이면 되돌리지 않고 BLOCKED) → 테스트 로그를 증거로
      → submit → Codex 리뷰(vfc-review JSON)
          ├ in-scope P0/P1 → reject → Claude 재작업(FINDINGS_TO_ADDRESS: fixed | false_positive+근거) → 재리뷰
          └ 없음 → complete(독립 리뷰어 · 리뷰 기록 · 모든 완료 조건 증거)
→ goal-check
```

## 상한과 멈춤

| 상한 | 기본 | 닿으면 |
|---|---|---|
| `--max-tasks` | 1 | 다음 작업을 고르지 않음 |
| `--max-minutes` | 90 | 단계 사이에서 멈춤 |
| `--max-cost-usd` | 15 | 단계 사이에서 멈춤(Claude 보고 비용 합) |
| `--claude-budget-usd` | 5 | Claude CLI 가 1회 실행을 끊음 |
| `--max-review-rounds` | 3 | 그 작업 BLOCKED |
| `--max-same-failure` | 2 | 같은 원인 실패 반복 시 그 작업 BLOCKED → 독립 작업으로 |

멈춤(우회하지 않음): `runtime/STOP` 파일(사용자 중단) · 인증 실패 · 사용량 제한. Codex 비용은 CLI 가 보고하지 않아 시간 상한으로만 묶인다.

## 안전

- **단일 writer**: `orchestrator--singleton` 잠금(주인 = 이 프로세스, 짧은 TTL — pid 가 살아 있으면 회수되지 않는다).
- **복구**: 진행 단계가 ORCHESTRATOR.json(journal)에 남는다. 다음 실행이 죽은 run 을 `aborted` 로 닫고, 그 run 이 쥔 작업을 reap → READY 로 되살려 다시 처리한다.
- **DB**: 자동 실행의 Claude 는 MCP 0개 — DB 경로가 없다. `db_scope` 가 있는 작업은 고르지 않는다(대화형 세션 몫).
  Bash 는 검증 명령(vitest·typecheck·lint·git 읽기/add/commit)만 허용하고 `node`·`npx`·`pnpm dlx`·설치는 막는다. 자식 환경의 DB 자격증명은 접속 불가 주소·빈 키로 덮는다(`DB_SENTINEL_ENV`).
  **남는 한계**: vitest 가 Claude 가 쓴 테스트 코드를 실행하므로 임의 코드 실행 경로가 완전히 닫히지는 않는다 — 자격증명이 없어 DB 에 붙지 못하고, 다른 worktree 쓰기는 실행 전후 대조(`foreign_worktree_write` → 차단·정지)로 잡는다. 컨테이너 격리는 아니다.
- **고아 자식**: Claude/Codex 는 감독자(`lib/supervise.mjs`)를 거쳐 뜬다. 감독자는 `claude.pid.json`·`codex.pid.json` 에 자식 pid 를 남기고 부모가 죽으면 자식 트리를 끝낸다. 복구는 자식이 살아 있으면 그 작업을 회수하지 않는다. 감독자는 기한(`VFC_SUPERVISE_TIMEOUT_MS`)도 직접 지킨다.
- **오류로 멈춘 run**(`stopped`)이 작업을 쥔 채 끝나도 다음 실행이 같은 방식(reap → READY)으로 복구한다 — `current_run` 이 아니라 모든 run 에서 찾는다(2026-10-09 T-0012 실측).
- **보고서 증거 규칙 위반**(빈·범위 밖 `covers`, `pass` 가 아닌 항목)은 실행 오류가 아니라 `bad_evidence` 재작업 사유다. `not_run` + 빈 `covers` 항목은 메모로 보고 증거에 넣지 않는다. 수정 전 실패(red) 로그는 `notes` 에 둔다.
- **Stop 훅 판정**(REVIEW_BLOCKED)이 구현 커밋을 막으면 리뷰·재구현으로 가지 않고 즉시 BLOCKED → 다른 독립 작업. 규칙: [STOP_HOOK.md](STOP_HOOK.md).
- **ChatGPT**: 응답의 `requires_user_approval` 은 권한 근거가 아니다. false 면 고쳐 받지 않고 `approval_conflict` 로 기록 → 관련 작업 실행 차단 → 사용자 APPROVED 결정으로만 `decision resolve-conflict`.
- **완전 무인 아님**: ChatGPT 기획은 사람이 요청 파일을 전달·응답을 저장한다. 사용자 승인(DB 쓰기·배포·시크릿·main 머지)은 사람만 기록한다.

## 실행

```
node bin/goal-check.mjs                 # 판정만
node bin/goal-priority.mjs              # 순위·실행 가능성만(상태 불변)
node bin/goal-orchestrator.mjs --max-tasks 1 --max-minutes 60 --max-cost-usd 10 --dry-run   # 선정까지
node bin/goal-orchestrator.mjs --max-tasks 1 --max-minutes 60 --max-cost-usd 10             # 실제 실행
```

## Goal Alignment Gate (2026-10-10)

목표: 작업 속도를 유지하면서 실제 최종 목표에 닿는 작업 비율을 높인다. 규칙·ID 만 쓴다(AI 호출 추가 없음). 코드 `lib/alignment.mjs`.

**작업 영향 계약 `impact`(신규 작업 필수 · seed 기존 작업은 `legacy`)** — `current_gap` · `expected_impact`(closes·advances·prerequisite) · `evidence_required[]` · 선택 `acceptance_ids`(기본 = claim 전부) · `parent_goal_id`(자신 또는 정본 상위) · `next_dependency` · `out_of_scope` · `dependency_type`(direct·prerequisite, prerequisite 는 `unblocks` 필수).
- `closes` ⇔ 겨냥 기준 full claim · 겨냥 밖 full claim 금지 · prerequisite 는 full 금지(기반 계약 완료 ≠ 목표 완료).
- `kind: independent` — 사용자 명시 요청 작업. `user_request_ref` 필수, 정본 claim 0(목표 PASS 근거가 되지 않는다), 리뷰는 자기 완료 조건으로.
- 사용자 목표 작업은 승인 설계에서 자동 생성(`UG@vN#i`). 같은 UG·버전·기준·겹치는 경로의 열린 작업은 중복.

**등록 시 검사(`task add` · 미리 보기 `task check --file`)** — 상위 목표·수용 기준 존재 · 갭(목표 PASS 면 `GAP_CLOSED`) · 열린 작업 중복(`DUPLICATE_TASK`) · full 완료 작업 재구현(`REIMPLEMENT`) · 정본 버전·기준 커밋 기록 · 소유권·범위·승인은 기존 규칙. 의도적이면 `duplicate_reason`·`reopen_reason`(기록에 남는다). 다른 작업의 `forbidden_paths` 는 이 작업 판정에 쓰지 않는다.

**리뷰 질문 2개(Codex 프롬프트)** — Q1 지정한 미완료 기준에 기여하나 · Q2 해결하지 못한 목표를 완료로 주장하나. 「아니오/예」 는 in-scope P1 → 기존 수정 루프. 전략 검토는 설계 충돌(kind design)일 때만 Work.

**완료 단계 분리** — `vfc goal level <VG>` · 사용자 목표 route: `TASK_COMPLETED`(작업만) → `GOAL_PARTIAL`(direct 기여) → `GOAL_VERIFIED`(수용 기준 전부, 사용자 수락 대기) → `USER_ACCEPTED`(사용자가 직접 기록한 결정만 · `recorded_via=agent` 불가). prerequisite 완료는 PARTIAL 로 세지 않는다. 상위 목표(L2)는 하위 L3 하나의 PASS 로 VERIFIED 가 되지 않는다(goalcheck 기존 규칙).

**다음 작업** — 같은 tier(실행 모드·사용자 목표 우선) 안에서 방금 끝난 작업과 같은 상위 목표 · 그 작업에 의존하는 작업 먼저, 그다음 기존 점수. 다른 목표로의 이동은 tier 가 정한다.

**지연(실측 · 실제 상태 13 작업)** — 등록 검사 0.40ms · 선정 정렬 추가 0.005ms · 목표 단계 0.003ms(기존 순위 계산 0.32ms). 작업 300개 합성에서도 등록 검사 < 50ms(테스트).

**회귀** `tests/alignment.test.mjs` — 지도 rev2.1(VG-L2-A1 ⊃ A1-01·A1-02) 실패 사례 5종(하위 완료를 전체 지도 PASS 로 · 재구현 · 다른 세션 금지사항 혼입 · 승인 없는 수락 · 증거 없는 원인 진단 완료) + 중복 · 간접 선행 허용 · 갭 · 독립 작업 · 다음 작업 · Codex 지적 3건.
