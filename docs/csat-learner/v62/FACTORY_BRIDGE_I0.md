# I0 — 학습지도 × 교재공장 Factory Bridge(계약 · 어댑터)

> 최초 기준 main `5e2aff89d`, 독립 보완 기준 main `9c19f15b1`(#276 병합). 코드 위치는 `apps/web/src/lib/csat/map/v62/factory-bridge/`(순수 · 서버 미연결 · 화면 변화 없음).
> 연결 모드는 **CONTRACT_ONLY** 다. 실제 주문 · 생산 · 출시 · 학생별 납품 · 학습 효과는 하지 않았고 주장하지 않는다.
> 공장 정본은 `origin/feat/textbook-factory-main` `663f2eee8`(main 에 없음 · 병합 · 복제하지 않음). 공장 쪽에 DB 의존은 없다.

## 0. 전체 흐름

```
WorkspaceDemand(demand.ts) ─ buildFactoryRequests ─▶ FactoryRequest(vf.factory-request/1)
        │                                                  │
        │  수요 줄마다 기존 재고 후보                         ▼
        └────▶ resolveStock(I0-3) ──▶ StockResolution ──▶ productionNeed(I0-4) ──▶ ProductionNeed(vf.production-need/1)
                     ▲ FQ A~H · 승인 · revision · 실행기 · 노출         │ crosswalkFor(I0-1) · projectUnits(I0-2)
                                                                       ▼
                         [사람 · 큐레이터 ProductBrief] ─▶ 공장 textbook-product-order/1 봉인(공장 쪽 · I3)
                                                                       ▼
                                   run(drain_hash · cell) ─▶ 산출물 ─▶ verifyLineage(I0-5) ─▶ 자격(C) ─▶ 승인 ─▶ 공급(B)
```

## 1. 파일과 책임

| 파일 | 책임 | 재사용 |
|---|---|---|
| `crosswalk.ts` | TASK ↔ 공장 스킬 · 제품군 후보(versioned). 용도별 사용 가능 여부 | `CANON_VERSION` |
| `material-unit.ts` | 수요 · 자료 · 생산 단위 분리, 근거 있는 변환만 | — |
| `stock-resolver.ts` | 후보별 상태 7종 · 줄 상태 4종 · 신규 생산 필요량 | `bindResult` · `approvalState` · `toSupplyQualification` · `supplyEligible` · `runnerFor` |
| `production-need.ts` | 요청 → 생산 필요(브리프 · 정책 누락 · 상태 사다리 · 공용 키) | `FactoryRequest` · `canonicalJson` · `ASSESSMENT_ROLES` |
| `lineage.ts` | 수요 요청 ↔ 주문 revision ↔ cell ↔ 산출물 N:M 검증 | 공장 `cell_id` 형식 |

기존 `demand.ts` · `supply.ts` · `persist-contract.ts` · `factory-integration.ts` · `qualification.ts` · `supply-store.ts` 는 **고치지 않았다**.

## 2. 적격 재고 해결기(I0-3)

후보 판정 순서는 아래와 같고, 먼저 걸리는 것이 상태가 된다.

| 순서 | 검사 | 실패 시 상태 |
|---|---|---|
| 1 | 실행기(`runnerFor` ∈ dcp_existing · csat_item_screen) | `blocked_runner`(학생 오답 아님) |
| 2 | 자격 기록 · 현재 revision · `bindResult`(revision · TASK · 역할) | `candidate_unreviewed` |
| 3 | F fail | `blocked_rights` |
| 4 | 평가 역할 E fail | `blocked_gold` |
| 5 | `supplyEligible`. 축은 pass 인데 승인만 없음 | `awaiting_release` |
| 6 | `supplyEligible`. 그 밖의 null/false(D 미확인 포함) | `candidate_unreviewed` |
| 7 | 평가 역할 노출 ≠ none(null 포함) | `blocked_exposure` |
| 8 | 평가 역할에서 같은 지문 두 번째 · 지문 미확인 | `blocked_exposure` |
| — | 모두 통과 | `eligible_existing` |

- 같은 산출물의 동일 후보는 적격 수에 한 번만 센다. 상충 revision/판정/승인 후보는 입력 순서와 무관하게 모두 보류한다. 서로 다른 연습 문항이 같은 지문을 쓰는 경우와 평가의 공유 지문 금지는 구별한다.
- 이 해결기는 순수 함수이며 서버 원장 reader/권한 인증이 아니다. 클라이언트가 준 FQ/승인을 실제 승인으로 인정하지 않고, I1/I2 서버가 현재 원장/권한/노출을 읽어야 한다.
- 줄 상태는 `satisfied`(신규 0) · `insufficient_quantity` · `not_installed` · `read_error` 다. 마지막 둘은 `newProductionNeeded = null` 로, 정상 0건과 구별한다.
- `supplyFor` 와의 차이: `supplyFor` 는 해설(교수 적합성 null)을 「available」 로 보인다. 해결기는 D 가 pass 가 아니면 적격으로 세지 않는다. `supplyFor` 는 학습자 화면 진단으로 그대로 두었다.

## 3. ProductionNeed(I0-4)

| 상태 | 조건 |
|---|---|
| `NOT_NEEDED` | 적격 기존 자료로 충족 |
| `UNKNOWN_STOCK` | 원장 미설치 · 읽기 실패 |
| `ASSESSMENT_NOT_FROM_FACTORY` | 독립 확인 · 전이 · 지연 — 공장 산출물로 공급하지 않음 |
| `UNMAPPED_TASK` | 대응 후보 없음 |
| `NEEDS_PRODUCT_BRIEF` | ProductBrief 9필드 중 누락, 또는 대응 미검증 · 주문 정책 6종 누락 |
| `UNSUPPORTED_PRODUCTION_UNIT` | 문항 → cell 변환 근거 없음 |
| `NEEDS_ORDER_VALIDATION` | 입력/대응/단위 필요조건이 충족되어도 실제 공장 planner·Product Order 검증기가 I0에 미연결이면 보류 |
| `READY_TO_SEAL` | 예약 상태. I0는 실제 공장 검증 영수증 없이 이 상태를 반환하지 않음 |
| `RUN_PENDING` · `RUN_RECORDED` · `ARTIFACT_CANDIDATE` | 후속 I3 검증기를 위한 예약 상태. I0의 자기보고 run flag/산출물 수로는 반환하지 않음 |

- 학습자 수요에서 나오지 않는 공장 필수값(`grade_scope · purpose · domain_weights · genre_weights · duration_days · units_per_chapter · difficulty · passage_words · source_strategy` + 정책 `source · rights · adaptation · benchmark · evidence · trust` 의 version/hash)은 **추정하지 않고 누락으로 보고**한다.
- `shareKey`는 `vf.production-share/2` 정규 본문의 hash다. TASK/정의 버전·역할·제품군·요청/공장 문항 유형·원천/제약/검수 요구·브리프·정책 6종의 version/hash·요청/적격/부족/생산 수량과 환산 근거·Crosswalk revision을 결속한다. 학습자·Workspace·목표/PLAN 버전은 제외한다. 같은 개인 수요가 반복되어도 `groupSharedNeeds`의 요청 ID는 한 번만 담으며, 이 함수는 수량 합계나 학생별 납품을 계산하지 않는다. 정책 참조 hash의 실제 원장 검증은 후속 서버 책임이다.
- ProductBrief 9필드의 존재 검사는 실제 공장 strict schema 검증이 아니다. schema·정책·plan hash·grade/target·unit/chapter/volume/layout 등 실제 주문 shell 및 `buildStructuredProductOrderDraft`/`sealProductOrder` 검증은 I3 연결 전까지 미검증이다. 이 검증기를 복제하거나 빈 값으로 대체하지 않는다.
- 음수/NaN/Infinity/비정수/안전 범위 밖 수량은 거절한다. 환산 factor는 유한 양수·비공백 evidence ID가 필요하며 상충 규칙/산출 수량 overflow는 UNKNOWN_UNIT이다.

## 4. 계보(I0-5)

공장이 실제로 주는 값만 쓴다.
- 주문: `product_order_id` · `order_revision` · `order_hash`
- cell: `cell_id = ${product_order_id}:r${order_revision}:d${day}` · `cell_hash`
- run: `drain_hash` · `manifest_hash`. 공장에는 `runId` 필드가 없다.
- 산출물: id · 종류 · 해시

검사하는 것: 낡은 주문 해시·다른 주문 cell·중복 cell/산출물 ID·cell 없는 산출물·양의 revision/day·빈 계보·형식에 맞지 않는 manifest hash. 반환은 `verification: STRUCTURAL_ONLY`, `contentVerified: false`, `supplyApproved: false`다. 64자리 해시 문자열이 맞아도 실제 주문/manifest/본문을 읽어 재계산한 것은 아니며, 실제 run/내용 검증이나 출시·공급 승인이 아니다.

## 5. 공장 연결 실측(663f2eee8)

| 항목 | 상태 |
|---|---|
| ProductBrief → plan → order 봉인 | 공장 쪽 코드 있음(메모리 · DB 없음) · 학습지도 서버 미연결 |
| order-production-run(드레인 cell 내보내기 → 채움 → 검사 → 조립) | CLI · 사람/에이전트 실행. 결과 상태 `blocked / assembled` |
| 제품군 능력 | P01–P20 전부 `PARTIAL` |
| 산출물 공급 | 권은 `publish_eligible:false` · 다학년 권은 `contract_only` |

그래서 I0 의 어댑터는 공장 계약의 **형식**까지만 맞추고, 실제 실행 결과는 I3 에서 같은 검증기로 받는다.
