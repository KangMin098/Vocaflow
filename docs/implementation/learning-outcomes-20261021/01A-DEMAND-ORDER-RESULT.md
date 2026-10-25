<!-- docs/implementation/learning-outcomes-20261021/01A-DEMAND-ORDER-RESULT.md -->
# 단계 1A 결과 — 저장 수요 → 실제 공장 주문 설계기

2026-10-21 · 구현·자체 API 검증: Claude Code(Opus 5.5, 새 세션) · 독립 검토: [Codex 완료(1A 범위)](./01A-CODEX-REVIEW.md) · 기준 HEAD `c2af9ad71f906c661640a65ced3eb828368c449c` + 이번 변경 · 검증 수준 L3. 아래 본문은 Claude 제출 원기록이며 후속 보완은 Codex 검토가 정본이다.

**이번 결과는 "실제 공장 함수로 주문 초안을 계산하는 관리자 API"까지다.** 계보 등록·생산·Workspace 납품·학습자 수행·재평가·브라우저 E2E는 실행하지 않았고 단계 1 전체는 미완료다. 학습효과 검증도 아니다.

## 변경 파일(6)

| 파일 | 내용 |
|---|---|
| `apps/web/src/lib/admin/factory-order-draft.ts` (신규) | 요청 strict 파서(3필드, draft는 공장 `structuredOrderDraftSchema` 그대로) · `FactoryOrderDraftReader`(조회 5개, 오류=throw, 없음=null) + Supabase 구현 · `prepareFactoryOrderDraft`(서명/정본/열 결속 → 현재성 → 역할 → `specFromDemand` → 대응 후보 → 개인 id 차단 → **실제 `buildStructuredProductOrderDraft`** → 제품군·문항유형 대응 확인) · `createFactoryOrderDraftPost`(가드·Origin·JSON·크기·형식 → reader 생성 순서, now 주입) |
| `apps/web/src/app/api/admin/csat/factory-order-draft/route.ts` (신규) | `requireAdminApi` · `createAdminClient` · 서버 경계 `now` 주입만 하는 배선 |
| `apps/web/src/lib/admin/__tests__/factory-order-draft.test.ts` (신규) | A1~A9 서비스·handler 시험 68건 |
| `apps/web/src/lib/admin/__tests__/factory-order-draft.fixture.ts` (신규) | v2 정본·DB 행·조회 대역(쓰기 메서드 없음)·P07 중1 draft |
| `apps/web/src/app/api/admin/csat/factory-order-draft/route.test.ts` (신규) | 실제 route 배선 2건(가드 실패 시 서비스 롤 클라이언트 생성 0) |
| `docs/ROUTES.md` | API 계약 한 단락 |

공유 helper·공장 package·crosswalk·migration은 고치지 않았다. web에 `zod` 직접 의존이 없어(시험이 `Failed to load url zod`로 실패) 패키지를 추가하지 않고 요청 최상위를 수동 strict 검사로, draft는 공장 schema로 검증했다.

## 설계 판단(검토 요청 지점)

- **현재성 기준**: 최신 목표 = `csat_map_goal_version` 사용자별 최대 id, 최신 계획 = Workspace 최대 `plan_version`(plan-store.ts와 같은 규칙). 수요의 goal·plan과 다르거나, 최신 계획의 `goal_version_id`가 수요 goal과 다르거나, `definition_version ≠ CANON_VERSION`이면 409 `stale_demand`.
- **정본 판정**: `JSON.parse` 후 web `canonicalJson`으로 다시 직렬화한 문자열이 저장 문자열과 정확히 같아야 한다(키 순서가 다른 본문은 서명이 맞아도 거절).
- **대응**: `crosswalkFor(task)` 중 guided_practice 후보의 제품군·문항유형과 실제 order가 겹쳐야 한다. 후보는 모두 `candidate/search_only`라 `crosswalk_not_validated` blocker가 항상 붙고 `registrable=false`다.
- **개인 식별자**: draft JSON에 수요의 user/workspace UUID가 들어 있으면 422(공용 order hash 오염 방지). 다른 형태의 개인정보(이름 등)는 검사하지 않는다 — 운영자 입력 책임으로 남음.
- **오류 노출**: 공장 오류는 메시지 앞 대문자 코드만(`PRODUCT_PLAN_STALE` 등) 또는 zod 경로만 돌려준다. 스택·입력값은 응답에 싣지 않는다.

## 수용 기준

| AC | 상태 | 근거 |
|---|---|---|
| A1 | PASS | 정상 수요+P07 중1 draft → 응답 order/order_hash/planning_hash가 같은 입력으로 직접 호출한 `buildStructuredProductOrderDraft`와 일치, 비영속 상태 필드 확인 |
| A2 | PASS | 401·403·curator 403 → reader 생성 0·조회 0·now 0(handler), route 배선에서 `createAdminClient` 0 |
| A3 | PASS | 다른/없는 Origin 403, text/plain 415, 깨진 JSON 400, 120001+ 413, UUID·서명 형식 400, user_id/workspace_id/role/quantity/approved/review_id/created_at 주입 400 — 모두 조회 0 |
| A4 | PASS | 호출자 서명 불일치·열 서명 불일치·비정규 직렬화·정본 user/workspace/goal/plan/definition/core 변조·줄 role/task/quantity/line_no/소유 변조 → 409 |
| A5 | PASS | paused·타인·없는 Workspace, 새/없는 목표, 새/없는 계획, 계획-목표 불일치, 구판 정의 → 409; 5개 조회 각각 오류 → 503; 줄·수요 없음 → 404 |
| A6 | PASS | 같은 입력·시각 → 같은 hash, 다른 주입 시각 → 다른 hash; 요청·DB 상태 객체 불변; reader 호출은 조회 5종뿐; Supabase reader가 insert/update/upsert/delete/rpc를 부르지 않음(가짜 클라이언트 연산 기록) |
| A7 | PASS | `PRODUCT_PLAN_STALE`·`GRADE_OUTSIDE_PLAN`·P20(capability 없음) 공장 코드 그대로 422; 정책 hash 형식 오류는 공장 schema가 400; 대응 밖 제품군(P05) 422 |
| A8 | PASS | independent_check·transfer·delayed_check·source_analysis 422 `role_not_supported`(낮추지 않음); 대응 없는 TASK 422 `task_not_mapped`; 성공해도 `mapping=candidate_unvalidated · registrable=false` + blockers |
| A9 | PASS | `createFactoryOrderDraftPost` 실제 handler → 서비스 → 실제 package planner/sealer, 대역은 DB reader뿐(200·409·503·422 경로) + 실제 `route.ts` 배선 시험 |
| A10 | PASS(범위 한정) | 아래 명령 전부 통과. 실DB 무쓰기(실DB 연결 자체가 없음), 브라우저 E2E 미실행, 단계 1 전체 미완료 |

## 실행한 명령과 출력 (2026-10-21, 작업 트리 = HEAD c2af9ad71 + 위 6파일)

```
$ pnpm --filter web exec vitest run --pool=forks --maxWorkers=1 --minWorkers=1 \
    src/lib/admin/__tests__/factory-order-draft.test.ts src/app/api/admin/csat/factory-order-draft/route.test.ts \
    src/app/api/admin/csat/product-order-lineage/route.test.ts src/lib/csat/map/v62/factory-bridge \
    src/lib/csat/map/v62/__tests__/delivery-binding.test.ts src/lib/csat/map/v62/__tests__/persist-contract.test.ts \
    src/lib/csat/map/v62/__tests__/r5-assessment-boundary.test.ts
 ✓ src/lib/admin/__tests__/factory-order-draft.test.ts  (68 tests)
 ✓ src/lib/csat/map/v62/factory-bridge/__tests__/factory-bridge.test.ts  (28 tests)
 ✓ src/lib/csat/map/v62/factory-bridge/__tests__/independent.test.ts  (49 tests)
 ✓ src/lib/csat/map/v62/__tests__/r5-assessment-boundary.test.ts  (24 tests)
 ✓ src/lib/csat/map/v62/__tests__/delivery-binding.test.ts  (10 tests)
 ✓ src/lib/csat/map/v62/__tests__/persist-contract.test.ts  (13 tests)
 ✓ src/app/api/admin/csat/product-order-lineage/route.test.ts  (11 tests)
 ✓ src/app/api/admin/csat/factory-order-draft/route.test.ts  (2 tests)
 Test Files  8 passed (8)
      Tests  205 passed (205)

$ pnpm --filter web exec tsc --noEmit -p .          → 출력 없음, exit 0
$ pnpm --filter web exec eslint <신규 5개 파일>       → 출력 없음, exit 0
```

기존 기준선 47건(delivery-binding 10 + persist-contract 13 + r5-assessment-boundary 24)은 그대로 통과했다.

**원시 로그 파일**: 외부 runtime 경로(`D:/workspace/Vocaflow-AI-Control/runtime/...`)와 작업 트리 로그 파일로 리디렉션하는 명령이 이 세션의 권한 설정에서 승인 대기로 막혀 파일로 남기지 못했다. 위 출력은 도구가 받은 원문을 옮긴 것이다. Codex 검토 때 같은 명령으로 재현해 로그를 보존해야 한다.

## 미실행 · 실패 · 한계

- NOT_RUN: `packages/library-pipeline` 자체 시험(`product-planning.test.ts`) — 명령이 승인 대기로 막힘. package 코드는 바꾸지 않았다.
- NOT_RUN: 실제 Supabase 조회(실DB·PGlite 모두). Supabase reader는 가짜 클라이언트로 쿼리 모양만 확인 — 실제 테이블의 컬럼명·bigint 반환형(`goal_version_id`가 number로 오는지)은 미검증. 1B 전에 읽기 전용 실조회 1회가 필요하다.
- NOT_RUN: 브라우저 E2E, 계보 등록(`product-order-lineage` 미호출), 생산, 납품, 학습자 수행.
- 실패 이력: 최초 시험이 web의 zod 미의존으로 suite 로드 실패 → 위 방식으로 해결. 픽스처 버그 1건(nulled demand에서 서명 읽기) 수정.
- 한계: `task_not_mapped`는 현재 정본 5 TASK가 모두 guided 후보를 가져 실제 정본 TASK로는 도달하지 않는다(합성 TASK로만 시험). 현재 대응 후보 5건은 모두 `candidate`라 성공 응답은 항상 `crosswalk_not_validated` blocker를 갖는다 — 이것이 의도된 사실이다.
- 데이터 쓰기 0 · migration 0 · 커밋 0 · push/PR/merge/로컬 통합 0.

## 다음 1B에 필요한 입력

1. 실제 DB의 guided_practice 수요 줄 하나(`demand_line_id` · signature) — 읽기 전용 조회로 존재 확인. 현재 수요가 대부분 independent_check일 수 있으므로 repair 단계 줄이 있는지 먼저 센다.
2. 실제 정책 참조 6종(source/rights/adaptation/benchmark/evidence/trust)의 version·hash 출처 — 시험의 '1'×64 같은 합성값은 정책이 아니다.
3. 그 TASK의 crosswalk 후보를 AI 교수 검수(Claude·Codex 독립)로 판정하는 증거 형식(`validationEvidenceId` · reviewer) — 이번 API는 이를 만들지 않는다.
4. 소량 생산 실행·manifest와 이 응답의 `order_hash`/`planning_hash`/spec을 잇는 계약, 그리고 계보 등록(`register`) 호출 시점의 사용자 승인 경계.

## R1 보완 — 실제 운영 호출부 (2026-10-21)

Codex 전역 검증에서 `route-callers.test.ts`가 4/5였다(factory-order-draft · product-order-lineage 호출부 없음). EXTERNAL 목록·스캐너는 바꾸지 않고 실제 관리자 CLI를 붙였다.

- 신규 `scripts/textbook/factory-order-draft.mjs` — Node 기본 API만. `prepare`는 `POST /api/admin/csat/factory-order-draft`, `lineage`는 `GET /api/admin/csat/product-order-lineage?user&workspace`. 등록·연결·철회·생산·납품 명령 없음.
- Cookie는 `VOCAFLOW_ADMIN_COOKIE`에서만(미설정·줄바꿈은 exit 2, 성공 아님) · 출력 미포함. base는 http loopback origin(localhost/127.0.0.1/[::1])만, 계정정보·경로·쿼리·fragment·https·외부 host 거절, `redirect: 'error'`. Origin·Content-Type JSON 명시. 입력 120000바이트·JSON 객체 검사. 인자·UUID·Cookie·loopback·기존 출력 검증 실패 시 fetch 0·쓰기 0.
- 비200·응답 파싱 실패·네트워크/redirect 오류·성공 shape 불일치(예: `persisted≠false`, `delivery≠not_performed`, lineage `status=error`)는 exit 1, 산출물 0, 원시 오류·헤더 미출력. 성공 시 `wx`로 새 파일에만 저장하고 초안·미검증 대응·생산/납품 미실행을 요약.
- 신규 `scripts/textbook/__tests__/factory-order-draft.test.mjs` — 합성 Cookie · fake fetch · 메모리 파일.
- `docs/ROUTES.md`에 호출 명령·권한·기록 미생성 한 단락.
- 기존 서비스 코드 변경 0.

### 실제 실행 결과

```
$ node --test scripts/textbook/__tests__/factory-order-draft.test.mjs
ℹ tests 9 · pass 9 · fail 0 · skipped 0

$ pnpm --filter web exec vitest run --pool=forks --maxWorkers=1 --minWorkers=1 src/app/api/__tests__/route-callers.test.ts
 ✓ src/app/api/__tests__/route-callers.test.ts  (5 tests)
      Tests  5 passed (5)
```

서비스 코드가 바뀌지 않아 이전 웹 205·tsc·eslint 결과는 재실행하지 않았다(HEAD·범위 동일).

### R1 미실행

- NOT_RUN: 실제 dev 서버에 대한 CLI 호출(실제 관리자 Cookie·로그인 없이 진행 — 지시상 금지). 실제 서버 응답과의 결합은 fake fetch 시험으로만 확인.
- NOT_RUN: 신규 `.mjs` 2개에 대한 eslint(웹 lint 범위 밖 `scripts/`).
- 커밋 0 — Codex 검토 뒤 커밋한다.
