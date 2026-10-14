# v6.2 — 학습지도 × Workspace × 교재공장 연계 계약

> 범위(2026-10-15 사용자 정정): 교재공장은 **구현된 독립 생산 시스템(블랙박스)**, 지금의 교재 · 콘텐츠는 **테스트성 산출물**이다.
> 이 문서는 학습지도 · Workspace 가 공장에 요청하고, 공장 결과를 검수 상태에 따라 Workspace 에 연결하는 **인터페이스**만 정한다.
> 공장 내부(공정 · 생성기 · 각색 · 조판 · 자동화) 변경, 실제 생성 · 적재 · 공개, 실행기 · 채점기 신규 구현, 승인안 A3 · A · C · B 적용은 범위 밖이다.

## 1. 흐름과 책임

```
LearningMap → LearningPlan → Workspace → WorkspaceDemand → FactoryRequest
   → [Content Factory · 블랙박스] → FactoryResultManifest → ContentQualification(FQ A~H)
   → WorkspaceContentBinding → LearningActivity(기존 실행기 · 외부)
```

| 단계 | 책임 | 코드(정본) |
|---|---|---|
| Learning Map | 목표 대비 필요한 TASK · 교육적 요구 | `v4/*` · `v62/rank.ts` |
| Workspace 수요 | TASK 를 배우는 데 필요한 역할 · 계획량 · 제약 | `v62/demand.ts` `WorkspaceDemand`(재사용) |
| Factory Integration Adapter | 수요 → 공장이 읽을 요청 명세 | `v62/factory-integration.ts` `buildFactoryRequests` · `order-spec.ts`(공장 유형 대응 재사용) |
| Content Factory | 실제 생성 | 기존 드레인 · 조판(변경 없음) |
| Content Qualification | TASK · 역할 · 권리 · 검수 적합성 | `v62/qualification.ts`(FQ A~H) · `qualifyArtifact` |
| Workspace Content Binding | 적격 산출물을 Workspace · TASK · PLAN 에 결속 | `bindToWorkspace` |
| Learning Activity | 학습 실행 | 기존 `DcpPlayer` · 기출 문항 화면(변경 없음) |

## 2. 공장 연결의 실제 상태 — `FACTORY_CONNECTION`

| 기능 | 상태 | 근거 |
|---|---|---|
| 주문 API · 영속 주문 | **UNSUPPORTED** | P-F0 감사 · 영속 표는 승인안 B(미적용) |
| 활동 · 지문 단위 생산 | **UNSUPPORTED** | 공장 단위 = 권(series × step) |
| 권 단위 생산 | MANUAL_DRAIN | `scripts/textbook/*-drain-*` 를 사람 · 에이전트가 실행 |
| 결과 manifest 반환 | **UNSUPPORTED** | 공장이 요청 id 로 결과를 돌려주지 않는다 |
| 연계 모드 | **MOCK_ONLY** | 이 문서의 요청 · 응답은 mock 시험으로만 검증 |

요청 명세를 만든 것을 「주문 접수」로, mock 응답을 「생산 완료」로 보고하지 않는다(`reportableStatus` → `MOCK_ONLY:…`).

## 3. WorkspaceDemand → FactoryRequest

`WorkspaceDemand` 를 그대로 쓰고(새 DTO 없음), 줄마다 요청을 만든다.

| 요구 필드 | 출처 |
|---|---|
| Workspace · 핵심 · 지원 TASK · 목표/PLAN/정의 버전 | 수요 |
| 교육 역할 · 학습자 수행 목표 · 요구 산출물 · 교수 단계 · 노출 규칙 | `ROLE_SPEC`(역할별 정의) |
| 교육적 이유 | 수요 줄 `reason` |
| 수량 | 수요 줄 n · `basis: plan_stage_quantity` — **이번 PLAN 단계 계획량**, 목표 달성 총량 · 점수 상승 추정 아님 |
| 원천 · 권리 조건 | `rightsUsable` · 미지원 시험 원천 제외 |
| 평가 · 노출 제약 | `gold` · `unseenByLearner` · `noExplanationBefore` |
| 콘텐츠 유형 | 기출 유형 → 공장 문항 유형(`CSAT_BACKING` 역대응) |
| 생산 후 검수 조건 | `OrderSpec.gaps`(단위 불일치 · 문항 단위 권리 · TASK 적합 · Gold · 실행기) |
| 재사용 허용 · 버전 제약 | `reuse` · `exact_revision` |
| 멱등 키 · 요청 id · 스키마 | `demandSignature:줄번호` · 정규 본문 SHA-256 · `vf.factory-request/1` |

**생산 단위 지원**(`unitSupportFor`): 지금 `supported` 는 없다.
`convertible_to_volume`(지도 연습 · 대응 유형 있음 → 권 단위로만) · `unit_support_needed`(설명 · 분석 활동) · `unsupported`(평가 역할 · 대응 유형 없음) · `unconfirmed`(기출 유형 미확인).
멱등: 같은 수요 revision → 같은 키 · 같은 id(`reuse`), 같은 키 다른 본문 → `reject`, PLAN 개정 · 다른 학습자 → 새 키.
재고 · 테스트 교재가 있어도 수요 줄은 지우지 않는다.

## 4. FactoryResultManifest(`vf.factory-manifest/1`)

필드: 요청 id · mode(`MOCK | REAL | EXISTING`) · 상태 · 실행 id · 생성 수 · 산출물(id · 종류 · revision · sha256 · 원천/분석/Gold 참조 · 유형 · 공장 주장 TASK · 역할 후보 · 접근 참조 · 권리 · 품질 · provenance · lifecycle) · 실패 이유 · 공장 이름/버전.
상태: `spec_created · order_received · unsupported · awaiting_production · produced · review_pending · review_failed · review_passed · failed`. **공급 허용은 공장 상태가 아니다** — 자격 · 결속 단계가 정한다(`factory_cannot_grant_supply`).

`validateManifest`: 스키마 · 요청 일치 · REAL 의 주문 계열 상태엔 실행 id · mock/real 섞임 금지 · 산출물 revision · 64자 해시 · 수량 일치 · 실패엔 이유.
`lifecycle: test_fixture` = 지금의 테스트성 교재 — 별도 승인 없이 `product` 로 바꾸지 않는다.

## 5. 자격 연결(FQ1.1 재사용)

`qualifyArtifact(artifact, request, fqResult, approval)` → `accept | review_pending | ineligible` + 이유.
테스트 교재 → 보류 · 공장 품질 실패 · 권리 제한 → 부적격 · 자격 기록 없음 → 보류(**유형 대응 ≠ TASK 적합**) · revision/TASK/역할 다름 → 보류(상속 금지) · fail 축 → 부적격 · unknown 축 → 보류 · 승인은 서버 원장 값만(연구 플래그 불인정).
학습자별 노출(G)은 여기서 판정하지 않는다 — 결속에 `learnerGate: check_at_delivery` 로 남고, 공급 시점 DB 함수(승인안 B `workspace_delivery_record`)가 본다.

## 6. WorkspaceContentBinding

Workspace · TASK · 역할 · 교육 목적 · 산출물(id/revision) · 판정 · 실행기 형식 · 공급 가능 수 · 계획량 · 충족도 · 막힌 이유 · `learnerGate` · 복귀 PLAN/TASK.
공급 가능 = accept ∧ 실행기 있음 ∧ manifest 오류 없음 ∧ mock 아님. 실행기 형식(FQR1 `a42b1ccc8` 실측과 일치): 기사 독해 17유형 `dcp_existing` · 기출 문항 `csat_item_screen` · vocab_choice `dcp_underline_dev_only`(P-F8d 격리 화면) · 나머지 교재 6유형 `adapter_needed`.
공통 콘텐츠는 여러 Workspace 가 재사용할 수 있지만 학생별 독립 수행 · 노출은 공급 시점에 따로 본다.

## 7. 시나리오 검증(mock · `factory-integration.test.ts` 19)

| | 시나리오 | 결과 |
|---|---|---|
| A | R5 기존 자산 | EXISTING manifest → 공급 2 · 기출 문항 화면 · 같은 PLAN/TASK 복귀 · 공장 주문 없음(평가 역할 unsupported) · 다 푼 경우 0 |
| B | V2 지도 연습 | vocab_choice 대응 · `convertible_to_volume`(활동 단위 미지원) · 적격이어도 실행기 개발 전용이라 공급 0 |
| C | S5 | grammar_choice 대응이어도 `task_fit_review` 필수 · 기록 없으면 보류 · 다른 TASK 자격 상속 안 함 |
| D | 테스트 교재 | `test_fixture` 유지 · 보류 |
| E | 검수 보류 | 원천 · 권리 · 실행 unknown → 목적별 보류 이유 · fail → 부적격 |
| F | 버전 변경 | `revision_mismatch` 보류 |
| G | 중복 요청 | 같은 revision 같은 id · 같은 키 다른 본문 거절 |
| H | 실제 파이프라인 미연결 | MOCK_ONLY · mock 산출물 공급 0 · 실행 id 없는 REAL 은 `spec_created` 로 보고 |

## 8. 기존 제품 영향

- 새 파일만: `factory-integration.ts` · `factory-mock.ts` · 시험. 기존 함수 서명 · 화면 · DB · RPC 변경 없음.
- 재사용: `WorkspaceDemand` · `demandSignature` · `orderSpecFor` · `qualification.ts` · `fulfillmentOf` · `dcp-types` · `dcp-underline`.
- 영속 주문(승인안 B)과의 관계: `FactoryRequest.idempotencyKey` 는 B 의 수요 서명과 같은 축이다. B 가 적용되면 요청은 `factory_order` 행 하나에 대응하고, manifest 의 REAL 상태는 `factory_order_event` 와 실행 id 로 증명된다.

## 9. 실제 공장 연결 체크리스트(미래 · 이번에 하지 않음)

1. 공장 쪽: 요청 id 를 받아 권 단위 드레인 실행에 실행 id 를 붙여 남기는 입구(공장 개선 제안 — 별도 문서로만)
2. 공장 쪽: 결과를 `vf.factory-manifest/1` 로 내보내는 출구(산출물 revision · 해시 · 원천/Gold 참조 · 권리 · 품질)
3. 제품 쪽: 승인안 C → B 적용, manifest REAL 상태를 `factory_order_event` 로 기록
4. 제품 쪽: 자격 원장에 산출물별 검수 행(검수 드레인 결과) · 승인
5. 제품 쪽: 실행기 어댑터(교재 6유형 · FQR1 계약) · 채점 확장(승인안 A3 계열)
6. 학습자 공급: `workspace_delivery_record` · 공급 시점 G
7. 테스트 교재 → 제품 전환은 콘텐츠별 별도 승인

## 10. 공장 개선 제안(범위 밖 — 기록만)

- 활동 · 지문 단위 생산 단위(지금은 권 단위뿐) — 지도 연습 묶음 요청을 그대로 받기 위해.
- 산출물 revision · 원천 revision · 해시를 생성 시점에 남기기(FQ1.0 「생성 당시 원문 revision 미결속」).
- 결과 manifest 출력(요청 id 결속).

## 11. 이번 작업의 0

실제 공장 생산 연동 0 · 실제 콘텐츠 생성 0 · 실제 검수 · 공급 0 · 학생 학습 실행 · 효과 검증 0 · DB · RPC 변경 0.
