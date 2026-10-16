# I0 — 학습지도 × 교재공장 Factory Bridge(계약 · 어댑터)

> 기준 main `5e2aff89d`. 코드 위치는 `apps/web/src/lib/csat/map/v62/factory-bridge/`(순수 · 서버 미연결 · 화면 변화 없음).
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
| `READY_TO_SEAL` | 브리프 · 정책 · 검증된 대응 · 단위 근거가 모두 있을 때(지금 0건) |
| `RUN_PENDING` · `RUN_RECORDED` · `ARTIFACT_CANDIDATE` | 실행 기록을 넘겨받았을 때(공급 승인 아님) |

- 학습자 수요에서 나오지 않는 공장 필수값(`grade_scope · purpose · domain_weights · genre_weights · duration_days · units_per_chapter · difficulty · passage_words · source_strategy` + 정책 `source · rights · adaptation · benchmark · evidence · trust` 의 version/hash)은 **추정하지 않고 누락으로 보고**한다.
- `shareKey` 는 TASK · 역할 · 제품군 · 문항 유형 · 브리프만으로 만든다. 학습자 · Workspace · 목표/PLAN 버전이 들어가지 않는다. `groupSharedNeeds` 는 요청 id 만 모은다.

## 4. 계보(I0-5)

공장이 실제로 주는 값만 쓴다.
- 주문: `product_order_id` · `order_revision` · `order_hash`
- cell: `cell_id = ${product_order_id}:r${order_revision}:d${day}` · `cell_hash`
- run: `drain_hash` · `manifest_hash`. 공장에는 `runId` 필드가 없다.
- 산출물: id · 종류 · 해시

검사하는 것: 낡은 주문 해시 · 다른 주문의 cell · 중복 cell · cell 없는 산출물 · 형식. `supplyApproved` 는 언제나 `false` 다.

## 5. 공장 연결 실측(663f2eee8)

| 항목 | 상태 |
|---|---|
| ProductBrief → plan → order 봉인 | 공장 쪽 코드 있음(메모리 · DB 없음) · 학습지도 서버 미연결 |
| order-production-run(드레인 cell 내보내기 → 채움 → 검사 → 조립) | CLI · 사람/에이전트 실행. 결과 상태 `blocked / assembled` |
| 제품군 능력 | P01–P20 전부 `PARTIAL` |
| 산출물 공급 | 권은 `publish_eligible:false` · 다학년 권은 `contract_only` |

그래서 I0 의 어댑터는 공장 계약의 **형식**까지만 맞추고, 실제 실행 결과는 I3 에서 같은 검증기로 받는다.
