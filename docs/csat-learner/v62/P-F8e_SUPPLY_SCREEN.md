# v6.2 P-F8e — 학습지도 · Workspace 공급 단계 화면 · 관리자 재사용 설계

> 상태: 학습자 화면 · 서버 읽기 계약 완료(읽기만). 영속 주문 · 공급 **표가 없으므로** 화면은 「주문됨 · 공급 완료」를 한 번도 표시하지 않는다(브라우저 실측).
> 관리자 화면은 설계만(새 시스템 만들지 않음). 저장 · 생산은 승인안 B · C 뒤.

## 1. 학습자 화면 — 한 줄의 공급 단계

`lib/csat/map/v62/supply-ledger.ts` `supplyStep(line, task, ledger)` — 순서: **실제 공급 행 → 실제 주문 상태 → 계산된 공급 상태**.

| 단계 | 근거 | 학습자 문구 |
|---|---|---|
| learn_now | 계산: 역할 자격이 확인된 자료 있음 | 지금 학습할 수 있어요 |
| read_now | 계산(I1): 열람 가능한 기존 해설 · 교수 적합성 검수 전 — 공급으로 세지 않음 | 지금 읽을 수 있어요 · 수업용 검수 전 |
| not_ready | 계산: 경로 없음 | 아직 준비되지 않은 자료 |
| stock_review_wait | 계산: 공장 재고 · 이 학습용 검수 전 | 교재 재고 있음 · 이 학습용 검수 대기 |
| release_wait | 계산: 출시 승인 대기 | 자료 준비됨 · 공개 승인 대기 |
| needs_review | 계산 | 근거 · 원문 확인 필요 |
| orderable | 계산: 공정 있음 · 주문 없음 | 만들 수 있는 자료 · 아직 주문 안 함 |
| ordered / producing / reviewing / held | **실제 주문 행** | 주문됨 · 만드는 중 · 검수 중 · 보류됨 |
| delivered | **실제 공급 행** + 서버 충족도(I1-P)에서 유효 공급 ≥ 요청 수량 | 공급 완료 |
| partially_delivered | 실제 공급 행 · 유효 공급 < 요청(I1-P) | 일부 공급됨 · 남은 자료 준비 중 |
| delivered_count_unknown | 실제 공급 행은 있으나 충족도를 못 읽음(P 미적용) | 공급 기록 있음 · 수량 확인 전 |

기록 상태 문장(숨기지 않는다): 표 없음 「아직 열리지 않았어요」 · 묶음 미저장 「저장하면 이어져요」 · 읽기 실패 「지금 읽지 못했어요 — 주문 여부는 표시하지 않아요」 · 읽음.
「학습에 필요한 자료」는 수요 줄 자체(역할 · 수량)로 보인다.

## 2. 서버 계약 — `supply-store.ts`(server-only · 읽기)

- 사용자 id 는 인증 세션 값만. 모든 표를 `user_id` 로 거르고, Workspace 는 그 사용자의 열린 것만(남의 · 닫힌 것 → 빈 기록).
- 표 없음(42P01 · PGRST205 …) → `not_installed`, 그 밖 오류 → `error` — 「없음」으로 삼키지 않는다.
- 클라이언트가 보낸 자격 · 승인 · 주문 상태를 받지 않는다. 공급 가능 여부의 최종 판정은 쓰기 시점 DB 함수(`workspace_delivery_record`)가 다시 한다.
- 지도 로더(`load.ts`)가 저장된 Workspace 마다 읽어 `data.v4.supplyLedger` 로 넘긴다.

## 3. 검증

- 단위: `supply-ledger.test.ts` 7(기록 없음 · 못 읽음 · 미저장에서 주문 계열 0 · 실제 행일 때만 · 다른 TASK/역할 기록 미사용 · 실패 주문 복귀) · `supply-store.test.ts` 5(미설치 · 오류 · 남의 Workspace · 사용자 필터 · 최신 주문).
- 브라우저(개발 서버 · 합성 계정, 끝에 삭제): `e2e-map-supply.mjs` 6/6 — ①b 「실제 주문 기록 없이 주문 계열 단계 0 · 기록 상태 no_workspace 표시」 추가, R5 기존 재사용 · 같은 TASK 복귀 · 학습자 분리 그대로.

## 4. 관리자 — 기존 교재공장 주문 화면 재사용(설계)

새 관리 시스템을 만들지 않는다. 기존 `/admin/csat/new`(`OrderWizard` · `order-model` · `order-view`) 와 화면도움말 `lib/admin/help/csat.ts` 를 확장한다.

| 관리할 정보 | 출처(승인안 B · C 뒤) | 붙일 자리 |
|---|---|---|
| 수요가 생긴 TASK · Workspace(익명화 수) | `workspace_content_demand(_line)` 집계 | 주문 마법사 첫 단계 「수요에서 시작」 탭 |
| 요구 역할 · 수량 | 수요 줄 | 같은 탭 |
| 공장 재고 · 생산 단위(권) | `textbook_shelf_inventory()` · `SERIES_CATALOG` · `order-spec.ts` | 기존 재고 표 |
| 검수 상태 · 승인 기록 | `content_qualification` · `content_release_approval/revocation` | 기존 검수 화면에 「자격 원장」 열 |
| 실제 주문 이벤트 · 실패 · 재시도 | `factory_order(_event)` | 주문 상세 타임라인 |
| 공급 가능 · 불가 사유 | `workspace_delivery_record` 거절 사유(문구 그대로) | 공급 시도 로그 |
| 최종 납품 | `workspace_content_delivery` | 주문 상세 |

화면도움말은 같은 커밋에서(`steps` · `cautions`: 주문 전이는 되돌릴 수 없음 · 승인 철회는 새 자격 필요). 이 설계는 B · C 적용 뒤 구현한다 — 지금 만들면 빈 표를 보여 주는 화면이 된다.
