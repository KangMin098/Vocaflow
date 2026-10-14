# PR264 — 실제 재현 결함 원장

2026-10-15. 검토 HEAD 8b4289f8196be3c7e81ab6393f60eee46d243e88. 아래11개는82개의 합성 순수 함수 진단 중40개의 기대조건 실패를 묶은 것이다. 실제 승인 자산·권리·학생 기록을 새로 만든 것이 아니다. P1은 향후 REAL 연결의 수용 차단 조건이며 현재 운영 취약점이 확인됐다는 뜻은 아니다. 새 함수의 제품 호출부는 없고 시험 파일에서만 사용된다.

## I01 · P1 · manifest 상태·열거값·실패 사유 검사와 공급 차단 불완전

함수: [validateManifest L185](../../../apps/web/src/lib/csat/map/v62/factory-integration.ts) · [bindToWorkspace L268](../../../apps/web/src/lib/csat/map/v62/factory-integration.ts)

실제 결과: 사용 불가 상태·unknown enum·빈 ID/실패 이유에도 supplied candidate가1로 계산된다. failure.code를 blockedReasons에 넣어도 수량 계산은 막지 않는다.

반례 ID: A-status-spec_created, A-status-order_received, A-status-awaiting_production, A-status-failed, A-status-review_failed, A-status-review_pending, A-status-unsupported, A-status-UNKNOWN_STATUS, A-unknown_type, A-unknown_mode, A-missing_failure_reason, A-empty_id

수정 제안: 상태별 허용 산출물/실행/검수 조합과 runtime enum/ID 검사를 추가하고, usable 상태 및 failure==null만 후보 계산한다.

## I02 · P1 · 중복 산출물과 revision 없는 판정 재사용

함수: [bindToWorkspace L268](../../../apps/web/src/lib/csat/map/v62/factory-integration.ts)

실제 결과: 중복/동일ID 다른revision은2로 세고, old verdict를 같은ID의 new revision에 사용하면1로 센다.

반례 ID: A-duplicate, A-mixed_revision, G-stale-verdict-id-only

수정 제안: ID/revision/hash/요청/TASK/role로 판정 결속; 동일 산출물 dedupe, 동일ID 다중revision은 명시 선택 정책 전 차단.

## I03 · P1 · 실행·mock provenance의 부분 결속

함수: [validateManifest L185](../../../apps/web/src/lib/csat/map/v62/factory-integration.ts)

실제 결과: manifest run과 artifact run이 다르거나 EXISTING에 mock artifact가 들어도1로 센다.

반례 ID: A-artifact_run_mismatch, B-existing-mock-contradiction

수정 제안: mode/provenance/runId 교차 검사; REAL run은 서버 실행 원장과 request/artifact에 결속하고 EXISTING은 서버 승인 자산 receipt만 허용.

## I04 · P2 · 요청 역할·단위와 산출물의 결속 누락

함수: [validateManifest L185](../../../apps/web/src/lib/csat/map/v62/factory-integration.ts) · [bindToWorkspace L268](../../../apps/web/src/lib/csat/map/v62/factory-integration.ts)

실제 결과: roleCandidates가 요청과 다르거나 요청 unit을 volume으로 바꾸어도1로 센다.

반례 ID: A-role_mismatch, A-quantity-unit

수정 제안: 허용 quantity/unit을 검사하고 공장 역할 주장 충돌을 검수 기록과 대조하여 보류.

## I05 · P1 · 선언형 lifecycle·REAL·승인 boolean을 신뢰하는 경계

함수: [qualifyArtifact L221](../../../apps/web/src/lib/csat/map/v62/factory-integration.ts)

실제 결과: 같은 합성 산출물을 product+REAL/EXISTING으로 선언하고 FQ pass/approval true를 주면 accept·후보1. 실제 승인 원장은 주지 않았다.

반례 ID: B-REAL-product, B-EXISTING-product, D-untrusted-approval-booleans

수정 제안: Trusted Qualification Context를 서버 내부에서 해석; lifecycle 전환 승인·실행/기존자산 receipt·권한/대상/범위/철회 검증 없는 boolean은 승인 아님.

## I06 · P1 · existingAssetManifest의 available 입력을 출시 승인으로 재작성

함수: [existingAssetManifest L299](../../../apps/web/src/lib/csat/map/v62/factory-integration.ts)

실제 결과: 임의 delivered ref와 임의64자 hash를 available로 입력하면 revision=released,rights=cleared,quality=passed,accept를 만들어 후보1. supply.qualification의 false/null도 무시한다.

반례 ID: C-unreleased, C-review_hold, C-wrong_TASK, C-attempted, C-wrong_revision, C-nonexistent, C-arbitrary_hash, C-arbitrary_rights_quality, C-shared_passage_seen, C-whole_exam_seen

수정 제안: 실제 기존 자산 reader의 검증된 receipt를 받고 ID/currentrevision/hash/TASK/role/release를 전달; 임의 SupplyLine만으로 승인 생성 금지.

## I07 · P1 · 원천·분석·Gold·artifact hash 변경이 FQ 결속에서 빠짐

함수: [qualifyArtifact L221](../../../apps/web/src/lib/csat/map/v62/factory-integration.ts) · [bindResult L67](../../../apps/web/src/lib/csat/map/v62/qualification.ts)

실제 결과: ID/revision/TASK/role이 같으면 artifact hash·source/analysis/Gold refs를 바꿔도 accept.

반례 ID: D-binding-sha256, D-binding-source, D-binding-analysis, D-binding-gold

수정 제안: 전체 immutable subject와 규칙/근거/승인 결속을 검사; null evidence는 role별 명시 NA 근거 없으면 HOLD.

## I08 · P2 · requestBody가 표준 JSON이 아님

함수: [requestBody L97](../../../apps/web/src/lib/csat/map/v62/factory-integration.ts) · [canonical L92](../../../apps/web/src/lib/csat/map/v62/factory-integration.ts)

실제 결과: requestId:undefined를 문자열에 포함하여 JSON.parse가 실패한다. 내부 해시 일치는 외부 호환성 증거가 아니다.

반례 ID: E-standard-JSON

수정 제안: requestId를 객체에서 실제 제거하고 JSON canonical serialization; unsupported values를 reject/JSON 정책으로 처리, Schema/예시·consumer parse 테스트 추가.

## I09 · P2 · nested demand property order가 멱등 키를 변경

함수: [canonicalDemand L14](../../../apps/web/src/lib/csat/map/v62/persist-contract.ts) · [demandSignature L29](../../../apps/web/src/lib/csat/map/v62/persist-contract.ts)

실제 결과: requires의 속성 순서만 바꾸면 idempotencyKey가 달라진다. FactoryRequest 자체 property-order canonicalization은 통과했다.

반례 ID: E-demand-nested-order

수정 제안: 공유 canonicalizer 또는 requires 고정 순서 직렬화; 배열의 의미 순서 정책 명시. support 변경 시 현재 같은key/body충돌은 안전 거절이나 revision 설계 검토 필요.

## I10 · P2 · 평가 역할의 후보 수와 fulfillment가 충돌

함수: [bindToWorkspace L268](../../../apps/web/src/lib/csat/map/v62/factory-integration.ts) · [fulfillmentOf L103](../../../apps/web/src/lib/csat/map/v62/supply.ts)

실제 결과: independent_check에서 suppliable1·planned3인데 assessment:null로 만들어 fulfillment=not_supplied.

반례 ID: G-assessment-fulfillment

수정 제안: 후보 충족도와 실제delivery 충족도를 분리; 공통 역할 자격은 계산 값 그대로 보존하고 fake delivered 배열로 DB공급을 표현하지 않음.

## I11 · P2 · source_analysis의 교수 적합성 실패가 허용됨

함수: [supplyEligible L97](../../../apps/web/src/lib/csat/map/v62/qualification.ts) · [qualifyArtifact L221](../../../apps/web/src/lib/csat/map/v62/factory-integration.ts)

실제 결과: D fail을 주어도 source_analysis는 accept; model_explanation/guided_practice는 차단.

반례 ID: H-teaching-fail-source_analysis

수정 제안: FQ11 역할 기준에 맞춰 source_analysis D 필수 또는 비교수 사용의 명시 NA 기준을 문서/코드에 함께 고정.

반례의 실제 입력·기대·출력은 [counterexamples.json](data/counterexamples.json)에 있다. C의10개 조건명은 공급 원장 부재라는 같은 경계를 각 요구사항으로 표시한 시험이다. 미출시·보류·노출 등을 실제 DB에서 발견한10개 자산으로 읽지 않는다. FQ/approval 전부pass는 명시적 합성 입력이다.

P3 확정 결함0. 후보 충족도와 실제 납품 용어 정리는 I10 수정에 포함한다. 기존 R5 계약을 새 AI 판정이 없다는 이유로 폐기하지 않고 실제 기존 승인/current revision/TASK/role/사용자 노출 reader를 유지한다.
