# Factory Integration v1.1 — Codex 독립 검토 P1 6 · P2 5 수정

> 기준: Codex 검토 `review/factory-integration-contract-v1` · `8e705307b`(검토 대상 PR #264 HEAD `8b4289f81`). 원본 검토 문서 · 최초 FAIL 원장(`counterexamples.json`)은 고치지 않았다.
> 범위: 순수 연계 계약 수정 · 시험 · 문서. 공장 내부 · 실제 생산/적재/공개 · 실행기/채점기 · DB/RPC/RLS · 승인안 A3/A/C/B 변경 없음.

## 1. 수용 판정(세 항목 분리)

| 항목 | 판정 | 근거 |
|---|---|---|
| ① 순수 연계 계약의 형식 · 안전성 | **PASS** | Codex 82 안전 기대조건 82/82(입력 정정 3건 — §3) · 원본 19/19 · 표준 JSON/Schema 7 |
| ② 기존 제품과의 회귀 호환성 | **PASS** | `src/lib/csat` · `components/csat` · `lib/learner` · `app` 2,542 통과 · R5 브라우저 e2e 6/6(합성 계정) |
| ③ 실제 교재공장 연결 | **MOCK_ONLY / NOT_CONNECTED** | 공장에 주문 API · 결과 manifest · 활동 단위 생산이 없다. 서버 Trusted Qualification Context reader 도 없다(승인안 B · C 미적용) |

## 2. 결함별 수정

| 이슈 | 등급 | 수정 | 시험 |
|---|---|---|---|
| I01 manifest 상태 · 열거값 · 실패 사유 | P1 | `validateManifest`: 상태 · 모드 · 종류 · 내용 유형 열거 검사, 상태별 산출물 유무, 실패 상태는 code · reason 필수 · 비실패 상태의 failure 금지. `bindToWorkspace`: **검수 통과(review_passed) ∧ 오류 0 ∧ MOCK 아님** 일 때만 후보를 센다 | A-status-* 8 · A-unknown_* · A-empty_id · A-missing_failure_reason |
| I02 중복 · revision 없는 판정 재사용 | P1 | 판정은 산출물 **주체**(id · 종류 · revision · 해시 · 원천/분석/Gold)에 결속 — 주체 없는 판정 `verdict_unbound` · 다른 주체 `verdict_subject_mismatch` 보류. 같은 id 중복 · 다중 revision 은 manifest 오류(선택 정책 없음 → 보류) · 같은 주체는 한 번만 센다 | A-duplicate · A-mixed_revision · G-stale-verdict-id-only |
| I03 실행 · mock 출처 | P1 | REAL: 주문 이후 상태엔 runId · 산출물 runId = manifest runId. EXISTING: runId 금지 · mock 산출물 금지. MOCK: mock 아닌 산출물 금지 | A-missing_run · A-artifact_run_mismatch · B-existing-mock-contradiction |
| I04 요청 역할 · 단위 결속 | P2 | 요청 단위는 「문항」 · 양의 정수만. 산출물 역할 후보 · 지원 TASK 가 요청과 맞아야 한다 | A-role_mismatch · A-quantity-unit |
| I05 선언형 lifecycle · REAL · 승인 boolean 신뢰 | P1 | `qualifyArtifact` 4번째 인자는 서버의 `TrustedQualificationContext`(브랜드 심볼 · `trustedQualificationContext()` 로만 생성)만 승인 근거. `{public, assessment}` boolean · 공장의 rights/quality/lifecycle · 연구 플래그는 `untrusted_qualification_context` 보류. 신뢰 문맥 안에서도 출처 미확인 · test_fixture 전환 승인 없음 → 보류 | B-REAL/EXISTING-* · D-untrusted-approval-booleans |
| I06 기존 자산 래퍼가 available 로 승인 생성 | P1 | `existingAssetManifest`: 요청 역할 일치 ∧ 기존 출시 계약의 7 자격 **모두 true** 일 때만 accept(아니면 `existing_unverified:<축>` 보류). revision 은 지어낸 'released' 대신 내용 해시, 권리 · 품질 칸은 'unknown' · 'unreviewed' | C-* 10 · C-wrapper-positive-control |
| I07 원천 · 분석 · Gold · 해시 변경 | P1 | 신뢰 문맥의 주체와 산출물 주체를 통째로 비교 — 하나라도 다르면 `subject_mismatch:<필드>` 보류. 연구 FQ 를 따로 넘겨도 원장 결과와 다르면 `qualification_not_from_ledger` | D-binding-* 6 · 원본 F 시험 확장 |
| I08 requestBody 비표준 JSON | P2 | `canonical-json.ts` 공용 정규화(중첩 키 정렬 · undefined 키 생략 · 표현 불가 값 거절) · requestId 를 객체에서 실제로 뺀 본문 | E-standard-JSON · factory-wire 7 |
| I09 수요 서명 중첩 키 순서 | P2 | `canonicalDemand` v2 = 공용 정규 JSON · 지원 TASK 포함(바뀌면 새 수요). 보류 SQL B 의 본문 버전 검사도 v2 로(미적용 · 저장된 v1 서명 0) | E-demand-nested-order · factory-wire |
| I10 후보 수 · 충족도 충돌 | P2 | `counts` 6단계 분리(생산 · 검수 통과 · 실행 가능 · 공통 자격 후보 · 학습자 공급 가능=null · 납품=null/원장값). `fulfillment` 는 **후보** 충족도, `deliveryFulfillment` 는 납품(미확인이면 unknown). 가짜 delivered 배열 제거 | G-assessment-fulfillment · G-candidate-not-delivery · 원본 「실제 실행 기록」 시험 |
| I11 source_analysis 의 D | P2 | `supplyEligible` · 보류 SQL C `fq_role_ok`: 원문 분석도 교수 적합성(D) 필수. not_applicable 은 null → 통과 아님 | H-teaching-fail-source_analysis |

## 3. 시험 입력 정정 r2(기준 완화 아님)

Codex 원본 82 중 3개는 서로 모순이라 어떤 구현도 동시에 만족할 수 없다:
- `G-stale-verdict-id-only` — ID 만 있는 판정 map(`accepted(m)`)이면 **후보 0**.
- `G-three-one-candidate` · `G-assessment-fulfillment` · `G-candidate-not-delivery` — **같은 모양**의 ID 판정 map 으로 **후보 1**.

판정에 revision 이 없으니 둘을 구별할 길이 없다. 안전 쪽(I02)을 따라 ID 판정을 거부하고, 세 G 시험은 기대값 · 판정 함수는 그대로 두고 **판정 map 만 주체 결속 판정**으로 바꿨다. `G-assessment-fulfillment` 는 추가로 산출물 역할 후보를 요청 역할로 맞췄다(원본 입력은 `A-role_mismatch` 가 0 을 요구하는 입력과 같다).
원본 입력 그대로 돌리면 79/82 — 실패 3개가 정확히 이 모순이다. 정정 위치 · 근거는 `fic-review-probes.test.ts` 머리말.

## 4. 표준 JSON · Schema

- `docs/csat-learner/v62/schema/factory-request.schema.json` · `factory-manifest.schema.json` — Codex 제안 Schema 채택(`$comment` 에 출처). 형식만 검사한다.
- `examples.json` — 지금 코드가 만든 요청(본문 · requestId) · mock test_fixture · 평가 역할 미지원 · 기존 R5 manifest. 시험이 코드 출력과 같은지 본다(낡은 예시 금지).

## 5. Trusted Qualification Context — 지금 없는 것

인터페이스(`TrustedQualificationContext`)만 있다. 이를 채울 서버 reader(자격 · 승인 원장 · 실행 원장 · 기존 자산 등록부 · 현재 산출물 해시)는 승인안 B · C 가 적용돼야 만들 수 있다 — **지금은 어떤 산출물도 신뢰 문맥으로 accept 되지 않는다**(제품 호출부 0). 학습자별 노출(G)은 계속 공급 시점 DB 함수 몫이라 `learnerSuppliableCount` 는 null.

## 6. 기존 R5

지금 학습자 화면의 R5 공급(`supplyFor` · 지도 Inspector)은 이 파일을 쓰지 않아 영향 없다(e2e 6/6). 래퍼만 엄격해졌다 — 기존 출시 계약이 7 자격을 모두 확인한 SupplyLine 만 후보.

## 7. 이번 작업의 0

실제 공장 호출 0 · 실제 콘텐츠 생성 · 검수 · 공급 0 · DB 변경 0 · 테스트 교재 승격 0 · 학생 효과 검증 0.
