<!-- docs/implementation/learning-outcomes-20261021/01A-DEMAND-ORDER-SPEC.md -->
# 단계 1A — 저장된 학습 수요를 실제 공장 주문 설계기로 전달

2026-10-21 · 주 목표 VG-L3-C1-01 · 관련 C2-01/B2-02 · 검증 L3. 작성·수용 검토: Codex. 구현: 새 Claude Code 세션.

## 원래 목표와 이번 범위

단계 1 전체는 수요→Product Order→생산→Workspace 납품→수행→재평가/다음 계획이다. 한 번에 새 독해 목표 시스템을 만들지 않고 기존 공장과 Workspace의 연결 공백부터 순차 구현한다.

- 1A(이번): 저장된 수요를 서버에서 읽어 기존 공장의 실제 `buildStructuredProductOrderDraft`에 전달하는 관리자 API. 명세를 호출하는 제품 API와 검증까지 만든다.
- 1B(다음): 한 목표에 대한 AI 교수 대응 검수와 실제 소량 생산 실행/manifest 연결.
- 1C: 기존 자격·철회·노출·납품 RPC로 Workspace 공급.
- 1D: 실제 수행·전이·결과의 다음 계획 반영 및 브라우저 완주.

1A 통과는 주문 등록·생산·납품·E2E 전체 통과가 아니다. 공장과 Workspace가 이미 존재하는 특화 경로를 연결하는 기술 단위이며, SD-R0-01 중등 일반 독해 출시 전략을 고등 수능으로 변경하지 않는다. 실제 ProductBrief의 학년/목적을 사용하며 목표 점수로 학년·난도·길이·학습량을 추정하지 않는다.

## 확인한 근거

- `factory-bridge/production-need.ts`는 공장 validator 미연결로 `NEEDS_ORDER_VALIDATION`을 반환한다.
- `packages/library-pipeline/src/textbook/product-planning.ts`의 `structuredOrderDraftSchema`, `planProductBrief`, `buildStructuredProductOrderDraft`가 실제 공장 설계·봉인 함수다. 앱 호출부는 없다.
- `workspace_content_demand.canonical`은 v2 정규 본문이고 `signature`는 그 SHA-256이다. `factory-bridge/order-lineage.ts`의 `specFromDemand`가 저장 본문에서 명세를 만든다.
- `factory-bridge/crosswalk.ts`의 대응은 현재 검색 후보다. 제품 주문을 설계했다는 사실로 대응을 validated로 만들지 않는다.
- 기존 `/api/admin/csat/product-order-lineage`는 등록·연결·철회 API다. 이번에는 호출하지 않는다.
- Codex 읽기 전용 DB 조회에서 factory_order, factory_product_order, learner_workspace, learner_workspace_plan, workspace_content_delivery, workspace_delivery_attempt, learning_task_attempts 존재를 확인했다. 새 테이블은 이번에 만들지 않는다.
- 기존 delivery-binding/r5-assessment-boundary/persist-contract 테스트는 worker=1로 47/47 통과했다. 로그 `D:/workspace/Vocaflow-AI-Control/runtime/learning-outcomes-20261021/baseline-tests.log`.

## 입력·서버 처리

새 POST `/api/admin/csat/factory-order-draft`는 **읽기와 주문 초안 계산만** 한다.

입력: `demand_line_id` UUID, `expected_signature` SHA-256, `draft`(기존 structuredOrderDraftSchema), 명시적 timestamp가 필요하면 서버 경계에서 주입. user/workspace/role/TASK/수량/승인 상태를 브라우저가 정본으로 보내지 않는다. 클라이언트가 보낸 추가 신뢰 필드는 strict schema로 거절한다.

1. `requireAdminApi`; curator를 포함해 admin 이외는 403. 인증 실패에서는 DB·본문 파싱·설계 호출을 하지 않는다. mutation API와 같은 Origin·JSON·최대 본문 크기 검사를 재사용한다.
2. 관리자 서버 DB로 demand line과 해당 demand, Workspace 활성·소유자·현재 goal/plan revision을 조회한다. 클라이언트 user/workspace를 믿지 않는다. 조회 오류·필수 행 누락·원장 모름을 빈 수요로 바꾸지 않는다.
3. 저장 canonical의 SHA-256과 expected_signature 및 행의 signature를 비교한다. canonical의 user/workspace/goal/plan/definition, 선택 line_no의 role/task/n이 DB 열과 다르면 거절한다. 현재 목표·계획과 다르면 stale 409. 문자열 JSON의 중첩 키 순서가 판정을 바꾸지 않도록 기존 정규 직렬화를 쓴다.
4. 저장 수요에서 `specFromDemand`를 호출한다. 최초 범위는 `guided_practice`만. independent_check/transfer/delayed_check는 별도 평가 계약이므로 거절한다. 수요와 맞지 않는 product family/skill을 조용히 맞다고 하지 않는다.
5. `buildStructuredProductOrderDraft(draft, nowIso)`를 실제 호출한다. plan hash·제품 capability·필수 정책·목표 불일치는 기존 validator가 거절한다. 시각은 의존성으로 주입해 시험이 날짜에 따라 깨지지 않게 한다.
6. 응답은 서버가 확인한 수요 참조, spec, 실제 공장 draft/order hash, planner capability, 대응 후보/누락/보류 이유다. `status='draft_prepared'`, `persisted=false`, `production='not_started'`, `delivery='not_performed'`, `mapping='candidate_unvalidated'` 등 사실을 구분한다. 대응이 없거나 맞지 않으면 actionable blocker와 함께 공급/등록 가능한 상태를 주지 않는다.

초안 설계는 공장 함수를 호출하지만 TASK 적합성·정책의 진위·이용권한·발행 승인을 인증하지 않는다. 임의 boolean이나 caller supplied review id로 이를 통과시키지 않는다. 공장 제품 주문 hash에 개인 식별자/학습자 메모를 섞지 않는다.

## 파일 책임과 수용 시험

허용 파일(추가가 필요하면 결과에 구체적 이유를 기록하되 총 변경은 30개 미만):

- `apps/web/src/lib/admin/factory-order-draft.ts`: 입력 schema, DB reader/기존 sealer 연결, 명시적 결과/error 타입, now 의존성.
- `apps/web/src/app/api/admin/csat/factory-order-draft/route.ts`: 기존 관리자 API 가드와 읽기 전용 처리.
- 각각의 `__tests__` 또는 route 인접 test: 실제 sealer를 mock하지 않는 정상 통합 사례, 가드/오류/반례.
- `docs/ROUTES.md`: API 계약.
- 이 작업의 `01A-DEMAND-ORDER-RESULT.md`: 실제 검증/미검증과 다음 하위 단계.
- 기존 기능의 공유 helper에 필요한 최소 변경만. 생산/공급 자격의 규칙 완화 금지.

| AC | 실제 검증 |
|---|---|
| A1 | 저장된 정상 수요+정상 draft → 실제 planner/sealer가 반환한 order/hash와 일치하고 비영속 상태를 명확히 반환 |
| A2 | 비로그인·비관리자·curator → 기존 가드 오류, DB/sealer 호출 0 |
| A3 | 잘못된 Origin/JSON/초과 본문/형식·추가 신뢰 필드 → 거절 |
| A4 | signature·canonical·line user/workspace/task/role/수량 변조 → 거절 |
| A5 | Workspace 비활성/타인 결속/goal 또는 plan 구판/필수 현재성 조회 실패 → stale 또는 명시적 unavailable, 초안 성공 0 |
| A6 | 동일 입력·주입 시각 → 동일 order hash; 입력 불변, DB 쓰기 0 |
| A7 | planner plan_hash·정책·제품 capability·target 불일치 → 기존 validator 오류를 숨기지 않음 |
| A8 | 평가 역할은 guided practice로 낮추지 않고 거절; 검색 후보를 검증·생산/납품 완료로 승격하지 않음 |
| A9 | 실제 API handler→서비스→실제 package validator의 통합 시험, 의존 DB 조회만 시험 대역 |
| A10 | 관련 타입·lint·기존 회귀 통과. 결과에 실DB 무쓰기·브라우저 E2E 미실행·전체 1단계 미완료를 구분 |

명령은 `pnpm.cmd --filter web exec vitest run --pool=forks --maxWorkers=1 --minWorkers=1 <새 tests와 관련 tests>` 및 변경 파일 ESLint, web `tsc --noEmit -p .`. 원시 출력은 외부 runtime의 이 세션 경로에 보존한다. tsc가 기존 문제로 실패하면 위치·현재 변경 관계를 분리해 기록하고 통과로 적지 않는다.

## AI 검증과 금지

Claude는 구현자·자체 API 검증자, Codex는 독립 목적/신뢰 경계/반례 검토자다. 다음 교수·학습자 검증도 모두 두 AI가 맡는다. 사용자 DB/삭제/배포 승인을 AI 검수로 대체하지 않는다.

새 목표 테이블, 정답률 임의 처방(0.8/0.5), 실제 DB 쓰기, 신규 migration, 원격 push/merge, 계보 등록·생산·발행·납품 실행은 이번 범위에서 하지 않는다. 구현 불가한 세부가 발견되면 검증을 약화하지 말고 정확한 blocker를 결과에 기록하고 가능한 코드/시험을 끝낸다.
