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

## 연속 운영 (WF-S14 · 2026-10-10)

새 오케스트레이터 없이 기존 루프에 붙였다. 한 실행 = 목표 재검사 → 브리지 tick → 선정(실행 모드 tier → 같은 목표 의존 작업 → 점수) → 승인·소유권·잠금 → Claude 구현 → 테스트 → Codex 리뷰 → 기록 → 반복. 끝: 작업 수·시간·비용 상한 · `runtime/STOP` · 실행 가능한 작업 없음.

**Work 브리지(이벤트형 · 상시 데몬 없음)** — `config/bridge.json`(`repo` · `app` · `wait_work_min` · `interval_s`)이 있으면 반복마다 `poc/work-bridge.mjs tick` 1회: ① 대기 요청 수집 ② 받아 둔 응답 인수(실패하면 다음 tick 이 재시도) ③ 대기 요청이 없으면 다음 PENDING 요청 하나 게시(단일 in-flight · 게시 전 검사·첨부 해시·이름공간 게이트 그대로). 응답은 PROPOSED 로만 — 승인은 사용자, 승인되면 `approveDesign` 이 초안·보류 작업을 되살리고 다음 반복이 실행한다. Work 대기 중에는 다른 목표의 실행 가능한 작업을 계속 한다. 고를 작업이 없고 응답 대기 중이면 `wait_work_min`(실행 예산 안에서)까지 tick 으로 기다린다. `--dry-run` 은 브리지를 부르지 않는다. 끄기 `VFC_BRIDGE_OFF=1` · 멈춤 `planning/bridge-watch.STOP`.

**세션 인계** — owner 와 세션을 구분한다. 실행 시작마다 `handoffDeadSessions`: 죽은 세션(pid 사망 + 잠금 ttl 경과)의 작업만 회수(살아 있는 세션 작업은 손대지 않음). 자동 재개 조건 = worktree 미커밋 변경 0 + HEAD 가 `vfc task start` 때 남긴 `run.start_head` 와 같음(죽은 세션이 커밋을 남기면 그 커밋이 리뷰에서 빠지므로 재개하지 않는다). 아니면 BLOCKED + 사유(사람 확인). owner 는 바뀌지 않는다. 오케스트레이터 자신의 비정상 종료 복구(`recoverPrevious`)는 기존 그대로.

**수용 기준별 상태** — 목표 검사가 `GOAL_STATUS.goals[*].criteria_status[criterion_id]` 에 덧붙인다(기존 필드·이력 그대로): `status` · `evidence_path` · `verified_commit`(PASS 일 때만) · `checked_at` · `verification_method` · `unmet_reason` · `tasks_completed` · `next_dependency`. 작업 완료(tasks_completed)와 기준 충족(status)을 따로 보인다. 정렬 게이트의 갭 판정도 겨냥 기준별로 본다.

**중복 리뷰 방지** — 같은 작업 · 같은 diff · 같은 리뷰 입력(보고서·완료 조건·범위·claim)에서 APPROVE(차단 0)였으면 재사용(`runtime/review-cache.json`, 이벤트 `review_cache_hit`). REQUEST_CHANGES·판독 실패·오탐 이의 라운드는 캐시하지 않는다. 리뷰 강도(effort)는 바꾸지 않았다.

**실측(2026-10-10)** — 기존 12 실행: 구현 53% · 리뷰 42% · 목표 검사 4% · 선정 0.5%(작업당 3.6분). 추가 비용: tick 유휴 ~110ms(프로세스 기동) · 실제 상태 dry-run 1.15s → 1.25s(브리지 포함) · 정렬 게이트 0.4ms.

## 리뷰 중복 점검 — RP-2026-10-10.1 (2026-10-10)

- 구현 Claude 는 `--no-session-persistence` 로 돌아 트랜스크립트가 없다. 그래서 전역 Stop 훅이 리뷰하지 않는다(실측: 오케스트레이터 작업 worktree 4곳의 Stop 판정 0건, hook.log 「no transcript」). 오케스트레이터 작업의 대표 리뷰는 이미 독립 리뷰 하나다. 위임 장치는 넣지 않았다.
- CRITICAL(require_review_pass) 작업이 요구하는 「그 커밋의 Stop REVIEW_PASS」는 대화형 세션에서만 생긴다. 그대로 둔다(약화 금지).
- 독립 리뷰 APPROVE 캐시(`runtime/review-cache.json`) 키에 **정책 판과 effort** 를 넣었다. 이전 정책이나 낮은 effort 의 APPROVE 를 높은 요구에 다시 쓰지 않는다. 옛 키는 자연히 빗나가 한 번 다시 리뷰한다. 리뷰 기록 md 머리에 「리뷰 정책 · effort · 캐시 재사용」이 남는다.
- Goal Check(`lib/goalcheck.mjs`)는 Codex 를 부르지 않는 결정적 증거 검사다(리뷰 기록 무결성 해시 · 커밋 · 범위 변경). 바꾸지 않았다.
- Codex 리뷰 「이전 판 작업에 소급」(P1) 판단: 오탐으로 둔다. 키가 바뀌면 이전 판 작업은 캐시가 **빗나가 한 번 더 리뷰받을 뿐**이다. 검증은 엄격해지는 쪽이고, 이전 판 판정·완료 기록은 고치지 않는다. 기록 머리의 정책 판은 「그 리뷰가 돈 판」이다.

## RP-2026-10-10.2 — 자동 Codex 리뷰 제거 (2026-10-10 사용자 결정)

- 구현 리뷰 · 담당 세션 제출 리뷰(`reviewSubmitted`) · 설계 조사에서 Codex 를 부르지 않습니다. `AUTO_CODEX` 는 기본 꺼짐이고, `VFC_AUTO_CODEX=1` 이면 옛 동작입니다(테스트 · 사용자 명시 요청).
- 리뷰 단계에는 「자동 Codex 없음」 인수 기록(`verification/reviews/…`, 정책 판 포함)을 남깁니다. **완료 여부는 `completeTask` 의 결정적 검사가 정합니다**: 통과가 아닌 증거 거부 · 수용 기준 전부 덮음 · 증거 커밋 일치 · 현재 설계 판 · 자기 리뷰 금지 · 과거 Stop BLOCKED 커밋 거부. 이 기록 자체는 PASS 근거가 아닙니다.
- **CRITICAL(`require_review_pass`) 작업은 계속 막힙니다.** 그 커밋의 Stop REVIEW_PASS 가 생기지 않기 때문입니다. 대체 독립 검증이 승인되기 전까지는 BLOCKED 를 유지합니다.
- Goal Check 는 바뀌지 않았습니다(원래 Codex 를 부르지 않는 결정적 검사).
- 회귀: `tests/no-auto-codex.test.mjs`(NC1–NC3: Codex 0회 · 통과 증거면 완료 · 실패·미실행 증거나 실패 보고면 완료 안 됨). 기존 테스트는 `VFC_AUTO_CODEX=1` 로 옛 경로를 계속 검증합니다.

## CRITICAL 대체 검증 계약 CRIT-EV-1 (2026-10-10)

자동 Codex 리뷰가 없어진 뒤(RP-2026-10-10.2)에는 `require_review_pass`(CRITICAL: 인증·권한·DB·학습 기록·데이터 계보) 작업에 필요한 「그 커밋의 Stop REVIEW_PASS」가 생기지 않습니다. 그래서 `completeTask` 는 아래 둘 중 하나를 요구합니다.
1. 그 커밋의 Stop REVIEW_PASS. 사용자가 요청한 수동 Codex 리뷰(`CODEX_REVIEW=1`)로 생깁니다.
2. **CRIT-EV-1 전부:**
   - 이번 run 증거가 모두 같은 검증 커밋을 적었다.
   - 그 커밋의 CI 통과 증거가 있다(`type ci`, 실행 URL).
   - 통합·e2e·DB 검증 증거가 있다(`integration`·`e2e`·`db_query`). 단위 테스트만으로는 부족하다.
   - 작업 owner 가 아닌 owner 가 붙인 독립 검증 증거가 있다(`review`·`manual`·`integration`·`e2e`·`db_query`). REVIEW 단계 증거는 다른 owner 만 붙일 수 있다.
   - DB 쓰기 작업이면 승인 기록(`task.approval`)이 있다.

하나라도 빠지면 기존 오류 코드(`REVIEW_PASS_REQUIRED` / `REVIEW_COMMIT_MISMATCH`)로 완료를 거부하고, 빠진 항목을 메시지에 적습니다. 자동 승격은 없습니다. 오케스트레이터의 「자동 Codex 없음」 인수 기록은 이 계약의 독립 검증으로 세지 않습니다(증거가 아니라 리뷰 기록이기 때문). 회귀: `tests/critical-evidence.test.mjs`(CE1–CE6), SH9.
