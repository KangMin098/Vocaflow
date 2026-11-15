<!-- docs/implementation/learning-outcomes-20261021/02E-CANONICAL-CYCLE-RESULT.md -->
# 2E 결과 — 실제 계획 POST·계산·AI 응답을 연결한 격리 순환

## Codex 최종 보완 — 아래 Claude 종료 시점의 미달 항목을 실제 실행

- Claude 신규 세션 `723076ca-9834-4c38-ad6e-f52b2ebaf142` 종료 뒤 Codex가 복제된 `postPlan` 구현을 제거하고 **실제 `/api/csat/diagnosis/map/plan` POST 핸들러**를 호출하도록 바꿨다. `world`도 실제 `composeV4`·`ranksOf`·`nextActionOf`를 호출한다. 인증과 페이지 로더 경계만 주입하고, 시험 회차·축 관찰·기준 문항은 합성 입력이다. 납품·시도·G2·설명·저장 계획은 같은 PGlite 정본 SQL에서 읽는다. 전체 `loadMapPage`/실제 Supabase RLS·동시성은 여전히 NOT_RUN이다.
- 실제 계산에서 차이가 드러났다. 종전 수동 사슬은 재확인 성공 뒤 TRANSFER를 예상했으나, 실제 compose는 전이 이력을 반영해 **resolved · MAINTAIN · recheck**를 만들었다. 최초 실행 13 PASS/1 FAIL에서 이 차이를 확인했고 올바른 계약으로 수정했다. 다음 `check_result` 계획도 같은 실제 API와 SQL로 저장한다.
- 전이 2·새 독립 확인 2는 신규 Codex 학습자 세션 `01a15e3a-dadd-73b2-b53b-5cfe934024c3`의 응답을 그대로 사용한다(1→0 인덱스 변환만). Claude 세션은 `cb000d69-4745-4583-b807-4420c21a154d`다. 초기 오답 상태는 합성 회귀이며 자연 발생 학습 향상/인과효과가 아니다. 두 역할의 8응답은 객관식/중심 판단 통과, 근거·관계 하위 판정의 불일치는 그대로 보존했다. 관계 선택지 설명이 빠졌던 V1도 별도 보존하고, 실제 UI 설명을 포함한 V2는 별도 신규 세션으로 실행했다.
- `evidence/2d-cycle/cycle-live-v2-ai-evidence.json`에 프롬프트·원본 응답·세션·실제 채점 결과가 있다. V1은 `cycle-live-v1-ai-evidence.json`. 실제 학습효과 추정치로 사용하지 않는다.
- Codex 재실행: 실제 API/SQL 순환 **14/14 PASS**, 공유 SQL 어댑터 변경을 포함한 관련 **97/97 PASS**, 변경 2파일 ESLint PASS, web typecheck PASS. 아래 표의 1921개는 Claude 종료 시점의 넓은 관련 검증이다.

아래는 Claude 종료 시점의 구현·검증 기록이며, route/compose/nextAction NOT_RUN 표기는 위 보완으로 대체한다.

2026-10-21 · 기준 HEAD `1c6735cc5`(미커밋 작업 트리 · 2D 변경 위) · Claude Code(Opus 5.5) 새 세션 · 공유 DB 조회/쓰기 0 · 마이그레이션 적용 0 · 커밋/push 0 · 사람 검토 행 0 · 네트워크 0.

## 결론

- **완료(격리 PGlite · 한 DB · 정본 SQL)**: 확인 오답 2(합성 회귀) → stage repair → 실제 `buildDemand` repair 줄 **그대로**(키 편집 없음) 주문 → 원문 교수 3활동 실제 채점 + 설명 → 영수증(service_role 경로) → repair 성공 → transfer → 보충 세트 실제 AI 검토 등록 → 실제 `requestAuthoredSupply`(transfer 단계 `buildDemand`)가 **서로 다른 지문 2** 납품(보충 `r5-cycle-transfer-2` 포함 · 이전 노출 0) → 정답 2(합성) → stage recheck → 같은 경로가 **새 독립 확인 2** 납품(이전 노출 0 · 전이와 합쳐 지문 4 모두 다름) → 정답 2(합성) → As-Is `resolved` · To-Be 요구 TRANSFER → 다음 계획 `check_result` 저장(저장 단계 = 재계산 단계 `transfer`) → 목표 변경 v · 재시도 키 · 낡은 버전 · 구계획 열기 `lineage_not_current` 기존 단언 유지. G2 6행 = 창작 평가 응답만(원문 안내 연습 · 교수에서 G2 0).
- **정답 응답은 Gold 로 만든 합성 회귀**다(기능 회귀). AI 학습자 관측 · 학습 효과 · 능력 향상 주장이 아니다. runtime 의 2역할 동결 응답은 쓰지 않았다.
- **NOT_RUN**: 실제 route 핸들러 `/api/csat/diagnosis/map/plan` POST 호출 · `composeV4`/`nextActionOf` 실호출 · SQL 위의 `loadMapPage` 전체 실행. 계획 저장은 여전히 2C 의 `postPlan()`(route 순서를 같은 함수로 따라 함 · 저장 RPC 는 실제) 과 `world()`(asIsMap → toBeMap → planWorkspaces → workspacePlan 사슬 · 도메인 입력 합성)다. 이 부분은 지시가 요구한 수준(실제 route · compose)에 **미달**이다.

## 고친 결함

| # | 결함(실측) | 수정 |
|---|---|---|
| 1 | 반례 `evidence/2d-cycle/source-history-counterexample-before.json`: 12:05 완료 교수를 12:10 에 투영 → composeV4 가 12:03 으로 재생하면 앞 단계 정오 true 로 12:01 성공 | `receiptActivity`: 정오는 **마지막 단계 행(완료 시각)에만**(완료 활동에서 채점기 정답이 하나라도 있으면 true · 기존 의미), 앞 단계 행은 늘 null. 행마다 `lessonStartedAt`(첫 시도 수신) — `guidedRepairAttempts` 가 활동 시작이 회차 앞이면 세지 않는다(회차 앞에서 시작해 안에서 끝난 활동 ≠ 새 회차 완료). 원장 시각은 그대로(행 answeredAt = 각 설명 수신). 성공 시각은 이제 완료 시각(T15, 이전 T11) |
| 2 | `loadSourceRepairReceipts` 가 42501 · 모든 DB 오류 · 모양 불일치를 `[]` 로 삼킴. `loadMapPage` 는 service_role 이라 늘 42501 → 끝낸 바로잡기가 조용히 사라짐 | SQL `source_lesson_repair_receipts(p_user, p_as_of)`: auth.uid 있으면 `= p_user` 만, 없으면 JWT role `service_role` 만(가장 없음). 내부 `source_lesson_fact_state(delivery, user)` 는 같은 검증된 사용자만 · 실행 권한 0. 기본 권한 public/anon/authenticated/service_role 회수 후 영수증만 authenticated · service_role. loader: 미설치(42883 · PGRST202)만 `[]`, 그 밖은 던짐. `loadMapPage` 는 서버가 인증한 userId 를 넘긴다 |
| 3 | `GUIDED_LESSON_ITEMS` 리터럴 3 | 공개 단계 이름 `SOURCE_LESSON_STEPS.length`(Gold · 모범 답 없음). 청사진 `LESSON_STEPS` 와 같은지 · 값이 그 길이인지 시험 |
| 6 | 2D 시험이 수요 `taskKeys` 를 지워 제품 spec `keys=[]` 에 맞춤 | 제품 경로는 이미 정상(실제 draft 가 DB 수요의 키로 spec 을 만든다). 시험 고정물만 문제였다 — `dcp-fixture` `prepared(keys)`/`packetOf(…, keys)` 로 실제 draft · packet 함수에 `checkKeysOfTask` 키를 넣어 **새 합성 계보 패킷**(입학 준비 아님 · 문항 바이트 동일)을 만들고, 1B 역사 패킷(keys [])은 기본값으로 그대로 둔다. 통합 시험은 실제 줄을 고치지 않는다 |

## 보충 세트(4)

- `apps/web/src/lib/knowledge/authored/r5-cycle-supplement.v1.json` = runtime `cycle-supplement.v1.json` 바이트 복사(sha256 `109c813e…2e39d74` 일치 · 시험이 재계산). 표식 없음 → 바이트 불변, `r5-central-meaning.v1.json` 불변.
- `SUPPLEMENTAL_SETS`(신뢰 레지스트리 · 정확한 세트 ID 키 · TASK · 역할 부분집합 · 보충 대상 · sha). `validateAuthoredSet` 이 이제 역할 계약을 직접 강제: 일반 세트 = 5종, 등록 세트 = 등록 부분집합과 정확히 같음 + TASK 일치. 이름만 바꾼 같은 내용 · 역할을 뺀 일반 세트 · 다른 TASK = 거절(시험).
- 레지스트리: 문항 id · (TASK, 지문 묶음) 전역 유일 · TASK/역할 조회 · ref 조회 시험. 클라이언트 TASK 표 시험은 TASK 당 1행으로 정정(보충 = 같은 TASK 두 번째 세트).
- 실제 `recordAiReviewedSupply` 로 등록: 영수증 `evidence/2d-cycle/cycle-supplement-ai-review.json` + 원본 `cycle-supplement-ai-evidence.json` 의 두 응답 · 세션 메타(Claude `d44fe4b7-…` · Codex `01a15e16-…`) — `verifyAiReviewReceipt` 가 원본 응답 sha · 세션 · 프롬프트까지 대조해 통과. `content_human_decision` 증가 0. 권리 부여 · 사람 검토 주장 없음. runtime 의 역할별 원본 폴더(input/result/session 파일)는 해당 이름으로 찾지 못해 복사하지 않았다 — 같은 내용이 evidence JSON 의 input/response/metadata 에 있다.

## 시험(실행 · Git Bash · 이 worktree)

| 명령 | 결과 |
|---|---|
| `pnpm --filter web exec vitest run src/lib/csat/map/v62/factory-bridge/__tests__/reassess-plan.pglite.test.ts` | PASS 14/14(2E 순환 1 추가 · 권한/기본 권한 단언 추가 · 2D 키 편차 제거) |
| `pnpm --filter web exec vitest run src/lib/csat/map/__tests__/source-repair-receipt.test.ts` | PASS 11(반례 · 회차 앞 시작 · loader 오류 · 청사진 길이 추가) |
| `pnpm --filter web exec vitest run src/lib/csat/map src/app/api/csat/diagnosis/map src/components/csat/factory src/lib/csat/authored src/app/api/csat/factory src/lib/knowledge` | PASS 133 파일 · 1921 · skip 2(`load.live` · `quality.live` — 공유 DB, 실행 금지) |
| `pnpm --filter web exec tsc --noEmit -p .` | PASS |
| `pnpm --filter web exec eslint <변경 TS 11 파일>` | PASS |
| `pnpm --dir apps/web exec tsx scripts/build-factory-dcp-harness.mts` | 724 KB · 고정물 변경 없음 |

## PASS / SKIP / NOT_RUN

- PASS: 위 표.
- SKIP: 공유 DB live 2 파일(기존).
- NOT_RUN: 실제 route POST · `composeV4`/`nextActionOf` · `loadMapPage` 전체(SQL 위) · 격리 Playwright(이번 변경은 화면 없음 · 2D 의 6 passed 는 이전 HEAD 상태) · 실제 Supabase 인증/RLS/동시성(PGlite 는 슈퍼유저 · JWT 클레임 대역) · `pnpm turbo` · `next build` · 공유 DB 적용 · `lock.mjs`.

## 공유 DB 설치(별도 승인 · L4)

`_pending_source_lesson_reflection.sql`(2B) 뒤 `_pending_source_lesson_repair_receipt.sql`. 함수 2개(표 · 행 없음). 서명이 2D 판과 다르다(`(uuid, timestamptz)` · `(uuid, uuid)`) — 2D 판은 어디에도 적용되지 않았다. 되돌리기는 파일 머리 주석.
