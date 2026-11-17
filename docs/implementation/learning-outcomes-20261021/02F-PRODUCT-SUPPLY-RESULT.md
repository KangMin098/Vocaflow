<!-- docs/implementation/learning-outcomes-20261021/02F-PRODUCT-SUPPLY-RESULT.md -->
# 2F — 공장 연습 자료 실제 공급 호출부 · 결과

기준 HEAD `d7ac6f17b`(지시의 `3acce9a79` 위 2F 명세 커밋). 커밋 · push · 공유 DB 쓰기 · SQL 적용 없음. 로드맵 · 커밋은 root 담당.

## Codex 최종 보완

신규 Claude 세션 `259b2469-d461-4958-99d6-d23534d898c7` 종료 뒤 실제 API→SQL 반례에서, 변경된 본문의 기존 납품을 delivered로 재표시하고 원천 부적격 뒤 과거 승인을 ok로 응답하는 두 결함을 재현했다(15개 중 1개 실패·단언 2개). 기존 납품을 실제 열기/현재성으로 재확인하고, 승인과 후보 검색 전에 원천 적격 RPC를 읽도록 고쳤다. 실패/잘못된 응답은 빈 성공으로 바꾸지 않는다. 현재 교수 자료에 정확히 결속된 원문 id/hash의 3활동만 요청하며, 철회·구판 제품주문 링크는 현재성 RPC로 거른다. 수정 뒤 관련 **41/41 PASS**, 변경 TS ESLint PASS. 생성 하네스는 gitignore에 추가했다. 아래는 Claude 종료 시점 기록이다.

## 만든 것 (제품 호출부)

| 경로 | 실제 호출 |
|---|---|
| Workspace `FactoryDcpCard` 「공장 연습 자료 요청」 단추 | `POST /api/csat/factory/request` 본문 `{template}` 만 |
| `app/api/csat/factory/request/route.ts` | 로그인(`learnerContext`) · Origin · JSON · 1024B · 닫힌 키 → `loadMapPage` → `composeV4` → `requestFactoryDcp` · no-store |
| `factory-bridge/dcp-request.ts` `requestFactoryDcp` | `buildDemand`(저장 계획 v · 목표 v) → 학습자 세션 `workspace_demand_record(canonicalDemand)` (source_analysis · model_explanation · guided_practice 모두 기록) → guided 줄의 기존 주문 또는 `factory_order_open`(결정적 키) → service SELECT `factory_order_product_link`(읽기만 · 없으면 `waiting_link`, 주문 보존) → service SELECT 등록 · 자격 · 승인 · 철회 · 대체 · 문항 → 같은 원문 요지→제목→주제 3후보 → **`receiveForLearner`**(읽기 전용 링커) → `workspace_delivery_record`(학습자 세션, 결정적 납품 키) |
| `dcp-admission/route.ts` `action:'approve'` | 닫힌 키 `{action, qualification_id, note}` → `approveFactoryDcp`: `factory_dcp_qualification`→`factory_dcp_admission`→`content_qualification` 결속(종류 dcp_item · 같은 판본 · guided · r.central_meaning · 미대체) + 원문 sha256 재확인 → 미철회 승인 있으면 같은 id · 철회면 거절 → **`approveForGuidedPractice`**(관리자 세션 `content_release_approve`) |
| 계측 | `csat_factory_dcp_requested{outcome: delivered/waiting_link/waiting_approval/not_in_stage/failed}` · `_pending_factory_dcp_learning.sql` CHECK 배열에 이름 추가(미적용) |

경계: 학습자 요청은 관리자 actor 를 고르지 않는다(링크는 기존 D3 `executeProductOrderLineage` link 를 실제 관리자가). service 클라이언트는 관리자 전용 표 SELECT 만, 쓰기는 모두 학습자 세션 · 관리자 세션 RPC. 조회 오류는 던져 502(빈 성공 아님), 미설치만 503.
관리자 승인은 API 만 있다 — 승인 전용 관리자 화면은 만들지 않았다(도움말 `csat-learner-plans` steps · ADMIN_CONSOLE 에 절차).

## 검증 (2026-10-21 로컬)

| 검사 | 결과 |
|---|---|
| `reassess-plan.pglite.test.ts` (정본 SQL 결합 설치 PGlite) | **PASS 15/15** (기존 14 + 2F 1). 2C 승인을 실제 `approveFactoryDcp`→관리자 세션 RPC 로 교체(새 승인 3건 생성). 2F 사례: 실제 route `POST` → 서비스 → SQL — 반례(타 Origin 403 · `userId`/`quantity` 키 400 · 깨진 JSON 400 · 계획 없는 B 409, 주문 0 증가) → `waiting_link` 주문 1 · 재요청 같은 주문 → 수요 줄 3역할 기록 · 주문은 guided 1줄(수량 3) → 실제 관리자 D3 link → `delivered` 3(같은 원문 · 같은 주문 · first = 요지) → `openFactoryDelivery` ok → 재시도 `replayed:true` 새 행 0 → 창작 자격 · 없는 id 승인 거절(RPC 전) · 기존 승인 replay(행 증가 0) · 학습자 세션 `content_release_approve` 42501. 인증 · 페이지 로더 · `createClient` 자리만 주입, 승인 · 수령 · 쓰기 함수 대역 없음 |
| `dcp-learning.pglite.test.ts` | PASS 35/35 (CHECK 새 이름 포함) |
| `factory-request.test.ts` (route 단위 + 카드 파서) | PASS 4/4 — 401/403/415/413/400×7, 409, 503, DB 오류 502, 잘못된 200 → failed |
| `dcp-admission/route.test.ts` | PASS 6/6 (approve 닫힌 본문 · 409/503 · 예외 503 · guard) |
| `vitest related` (변경 11파일) | **PASS 57 파일 / 831 테스트**, SKIP 1(`db-allowlist.integration` — 실 DB 필요, NOT_RUN) |
| `tsc --noEmit -p apps/web` | PASS |
| ESLint 변경 파일 | PASS(0 경고) |
| PC1440 Chromium `factory-card-request.isolated.spec.ts` (실제 카드 + 앱 CSS 하네스, 응답 page.route) | PASS 1/1 — 빈 목록 → 502 실패 alert → 다시 요청 → 잘못된 200 failed 유지 · 링크 없음 → 제작 연결 대기 → 받음(첫 요지 링크 · 목록 3) · 내부 id 글자 노출 없음 · 44px · 가로 넘침 없음 · 이벤트 4 · pageerror 0. 캡처 `apps/web/playwright-auth/shots-2f/01~04`. 하네스는 WorkspaceModal 바깥 여백 맥락 없이 카드만 그린다 |

NOT_RUN: 실제 RLS · 두 연결 동시성(PGlite 슈퍼유저 단일 연결) · 공유 DB · 로그인 dev 서버 E2E · CI. 하네스 HTML(`tests/fixtures/factory-card-harness.html`)은 생성물(미추적).
주장하지 않는 것: R0 전체 · 사람 학습 · 인과 효과. 승인 · 링크는 격리 DB 의 시험 관리자 계정이며 실제 공급 승인이 아니다.
