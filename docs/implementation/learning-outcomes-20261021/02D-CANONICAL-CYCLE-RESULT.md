<!-- docs/implementation/learning-outcomes-20261021/02D-CANONICAL-CYCLE-RESULT.md -->
# 2D 결과 — 원문 교수 활동을 실제 단계 순서(repair)에 연결 · **부분 완료**

> **2E 정정(2026-10-21 · [02E-CANONICAL-CYCLE-RESULT.md](./02E-CANONICAL-CYCLE-RESULT.md))** — 아래 2D 서술 중 세 가지가 틀렸거나 바뀌었다.
> ① 「완료 1ms 전 asOf = 실패(미래 유입 없음)」는 직접 과거 asOf 호출만 본 것이다. loader 가 now 로 투영한 행을 composeV4 가 더 이른 asOf 로 재생하면
> 앞 단계 정오(true)로 완료 전 성공이 났다(runtime 반례 `evidence/2d-cycle/source-history-counterexample-before.json`). 2E 에서 수정.
> ② 「service_role · 42501 · 오류 = 빈 목록」은 끝낸 바로잡기를 조용히 지우는 결함이었다. 2E 에서 RPC 를 `(p_user, p_as_of)` 로 바꾸고 미설치 외 오류는 던진다.
> ③ 「taskKeys 만 등록 spec 에 맞춘 줄」 편차는 제거했다(실제 줄 그대로 주문). transfer · recheck 는 2E 에서 실행했다. route HTTP 는 여전히 NOT_RUN.

2026-10-21 · 기준 HEAD `1c6735cc5`(미커밋 작업 트리) · Claude Code(Opus 5.5) · 새 SQL 1(보류) · 공유 DB 조회/쓰기 0 · 커밋/push 없음 · 사람 검토 행 0.

## 결론

- **완료 — check → repair → 원문 교수 → transfer 계획 저장(격리 PGlite · 정본 계획 SQL)**: 실제 오답 확인(합성 회귀 2)으로 stage `repair` → **실제 `buildDemand`** 가 repair 단계에서만 `source_analysis·model_explanation·guided_practice`(사유 `stage_repair`)를 내고, check 단계에서는 `independent_check` 만 낸다(2C 의 수동 guided 수요는 실제 순서가 아니었음을 시험으로 고정) → 그 안내 줄로 개인 주문 · 원문 3활동 납품 → 실제 채점 + 설명 저장 → 새 RPC `source_lesson_repair_receipts` → 제품 함수 `loadSourceRepairReceipts`/`receiptActivity` → 실제 `repairGate` 성공 · `workspacePlan` stage `transfer` → `learner_workspace_plan_commit` 저장 계획의 TASK stage = `transfer`.
- **완료 — 같은 목표의 다음 계획 뒤 순환 없음**: 새 plan 버전 저장 뒤 영수증 `current=false` · 완료 시각 불변 · 바로잡기 링크 0 · `repairGate` 성공 유지 · stage `transfer` 유지(repair 로 되돌아가지 않음). 구계획 자료 신규 열기는 그대로 `lineage_not_current`.
- **미완료(정확한 남은 일)**: transfer(미노출 2지문 수행) → recheck(새 독립 2) → 결과 → 새 계획. root 보충 세트(`cycle-supplement.v1.json` · 영수증 존재 확인)는 3문항(독립 2 · 전이 1)이라 현재 제품 레지스트리 `AUTHORED_SETS` 와 `validateAuthoredSet`(역할 5종 요구)에 그대로 들어가지 않는다. 등록 규칙(세트별 역할 부분집합 허용)과 레지스트리 추가 + 바이트 복사가 필요해 이번 범위에서 하지 않았다. 바이트 복사 · 가짜 검토 없음.
- 실제 route 핸들러 HTTP(`/api/csat/diagnosis/map/plan` POST) · `composeV4`/`nextActionOf` 실호출 · `loadMapPage` 전체 실행은 **NOT_RUN**(아래). 효과 주장 없음 — 영수증은 수행 사실이며 능력 · 향상 근거가 아니다. 오답은 합성 회귀이며 AI 학습자 관측이 아니다.

## 변경

| 파일 | 내용 |
|---|---|
| `supabase/migrations/_pending_source_lesson_repair_receipt.sql` (신규 · 보류) | `source_lesson_fact_state(delivery)` — 1D `factory_dcp_delivery_state` 와 같은 검사(본인 · 원문 003946dd/33dc4880 · 역할/TASK · Workspace 열림 · 판본 · `supply_delivery_valid` 철회 · 제품 링크/현재성)에서 **최신 plan 요구만 빼고** 수요 goal = 현재 목표를 요구. `source_lesson_repair_receipts(p_as_of)` — 주문별 세 단계: 설명 1행 + 그 설명이 가리킨 실제 채점 영수증(정오 = 채점기 값) · `complete`(3단계) · `completed_at`(마지막 설명 수신) · `current`(=`factory_dcp_learning_current`). asOf 뒤 수신 제외 · auth.uid 없음 = 42501. 새 행 · 새 시각 없음 |
| `apps/web/src/lib/csat/map/source-repair-receipt.ts` (신규) | 닫힌 모양 파서(complete/completed_at 재계산 대조 · 단계 중복 · 시도>설명 시각 = null) · 시각 ISO(Z) 정규화 · `receiptActivity`(repairRole guided_practice · itemRef `dcp:` · 미완료는 isCorrect null · asOf 재검사) · `receiptTargets`(current 만 링크) · `loadSourceRepairReceipts` |
| `apps/web/src/lib/csat/map/load.ts` | `loadMapPage` 가 영수증을 `lifecycleActivity` 와 `repairTargets` 에 더한다(asOf = now · 실패/미설치 = 더하지 않음) |
| `apps/web/src/lib/csat/map/v62/demand.ts` | `GUIDED_LESSON_ITEMS` — 안내 연습 기본 수량 = 청사진 활동 수(r.central_meaning 3 · 한 지문). 이전 1 로는 DB 가 3활동 주문을 거절했다(`quantity 3 exceeds remaining shortfall 1` 실측) |
| `apps/web/src/lib/csat/authored/__tests__/authored-flow.pglite.test.ts` | 그 결과(창작 안내 재고 2 전부 납품 + 부족 1 생산 주문)를 명시 고정 |
| `.../__tests__/source-repair-receipt.test.ts` (신규 7) · `.../factory-bridge/__tests__/reassess-plan.pglite.test.ts` (+4 · 기존 수정) | 아래 |
| `docs/CHANGELOG.md` | 한 줄 |

## 실측 결함 2

1. **시각 표기**: PGlite 가 `+09:00` 표기를 돌려주고 `repairAttempts` 등은 문자열 비교라 순서가 틀어진다 → 파서가 ISO(Z) 정규화(같은 순간 · 의미 불변).
2. **1B 제품 spec ↔ 실제 수요 줄**: 실제 `buildDemand` 안내 줄 `taskKeys=['claim-support']`, 등록 제품 spec `keys=[]` → D3 링크 `spec mismatch` 거절(시험이 거절을 단언). 이후 단계는 **taskKeys 만** 등록 spec 에 맞춘 줄로 진행했다(역할 · 사유 · 유형 · 요구 · 수량 3 · plan/goal 은 실제 값). 제품 spec 재등록 또는 키 정규화는 결정 필요.

## 시험(정본 순서 · 한 DB)

설치 순서는 2C 와 같고 마지막에 `_pending_source_lesson_repair_receipt.sql` 을 더한다. `world()` 의 `Date.now` 를 원장 최대 시각 + 1초로 바꿨고, 확인 오답 answeredAt 은 1회차 교수 완료 + 1ms(벽시계 자기 노화 없음).

1. 2C 회차 앞 교수 3활동 → 영수증 complete/current · 정오 true×3 · asOf 2000년 = 없음 · 타인 B = 없음 · auth 없음 = 42501 · G2/영수증 행 수 불변.
2. 확인 오답 2 → stage repair → v2 `check_result` 저장. 영수증 current=false · 링크 0 · **이전 회차 완료는 repairGate 성공 아님**. 실제 buildDemand: repair 줄 3역할 · guided n=3 · check 단계 = independent_check 만.
3. repair 회차 안: 실제 줄 그대로는 D3 거절 → taskKeys 정렬 줄로 주문 · 3납품. 1활동 시도만 = 영수증 없음 · 2/3 설명 = complete false · repairGate 실패. 3/3 = 성공 · 완료 1ms 전 asOf = 실패(미래 유입 없음) · `world()`(제품 loader 함수 사용) stage `transfer` · `learning_task_attempts` 는 창작 독립 2행 그대로.
4. 같은 목표 다음 계획 v3 저장 → 저장 plan stage `transfer` · 다시 계산해도 `transfer` · 완료 시각 불변 · current=false · 링크 0 · 구계획 열기 `lineage_not_current`.
5. 새 목표 g2 → `goal_changed` · `goal_change` v4 · 영수증 = 없음(이전 목표 회차 사실 비이월) · 설명 6행 보존.

## 실행 명령 · 결과(Git Bash, 이 worktree)

| 명령 | 결과 |
|---|---|
| `pnpm --filter web exec vitest run src/lib/csat/map/v62/factory-bridge/__tests__/reassess-plan.pglite.test.ts` | PASS 13/13 |
| `pnpm --filter web exec vitest run src/lib/csat/map src/app/api/csat/diagnosis/map src/components/csat/factory src/lib/csat/authored src/app/api/csat/factory` | PASS 99 파일 · 1460 · skip 2(`load.live` · `quality.live` — 공유 DB 시험, 실행 금지) |
| `pnpm --filter web exec tsc --noEmit -p .` | PASS |
| `pnpm --filter web exec eslint <변경 6 파일>` | PASS |
| `pnpm --dir apps/web exec tsx scripts/build-factory-dcp-harness.mts` | 724 KB(번들 가드 통과 · 컴포넌트 변경 없음) |
| `pnpm --dir apps/web exec playwright test -c playwright.isolated.config.ts tests/e2e-isolated/source-lesson.isolated.spec.ts tests/e2e-isolated/factory-dcp-runner.isolated.spec.ts` | 6 passed · 0 skip |

교수 JSON SHA `0b653454…c7f0` · v3 세트/영수증 5 미변경. 화면 · 도움말 변경 없음(캡처 없음).

## PASS / SKIP / NOT_RUN

- PASS: 위 표.
- SKIP: 공유 DB live 2 파일(기존).
- NOT_RUN: transfer 2지문 · recheck 2 · 결과 → 새 계획(보충 세트 등록 필요) · 미노출 재사용/구원천 철회 반례의 영수증 판(철회는 SQL 검사가 있으나 시험 없음) · 실제 route HTTP · `composeV4`/`nextActionOf` · `loadMapPage` 전체 실행 · 실제 Supabase 인증/RLS/동시성 · 실로그인 E2E · `pnpm turbo` · `next build` · 공유 DB 적용 · `lock.mjs`.

## 설치 순서(공유 DB · 별도 승인)

`_pending_source_lesson_reflection.sql`(2B) 뒤에 `_pending_source_lesson_repair_receipt.sql`. 함수 2개만 추가(표 · 행 없음). 되돌리기는 파일 머리 주석.
