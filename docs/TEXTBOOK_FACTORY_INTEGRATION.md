# 교재 공장 통합 계약 — Phase 1

기존 `/admin/csat` 9공정과 Academic Reading의 공통 입력은 `textbook-product-order/1`이다. 정본은 `packages/library-pipeline/src/textbook/factory-order.ts`, 브라우저에서 안전하게 읽는 상태→공정 대응은 `factory-order-stage.ts`다. 이 계약은 생산·인증·DB 승격을 실행하지 않는다. 현재 실제 시중 교재 benchmark corpus, Gold-S, DB seed는 모두 0이다.

## 주문과 타겟

한 주문은 `product_order_id + order_revision`으로 식별하고, 동일 원문을 여러 학년으로 만들면 별도 주문과 별도 target hash를 사용한다. 주문은 시리즈·판본, 기존 `readingTargetSchema`의 연령/언어/사고 수준·R skill·P군, 목적·시험, 도메인/장르 비율, 원천·권리·각색 정책 판본, 지문·문항 난도, 문항/활동 유형, 단원/장/권/조판 규격, benchmark·증거·신뢰 정책 판본, 작성/봉인 시각을 포함한다. 키 순서가 다른 동등 JSON은 동일한 canonical SHA-256으로 식별한다. 학년 한 필드나 문항 난도 한 수치로 지문 수준을 대체하지 않는다.

`PRODUCT_CAPABILITIES`는 P01~P20 전체를 등록하지만 현재 **완성 교재 지원표가 아니다**. `PARTIAL`은 기존 문항/조판 계약의 일부만 이용 가능하다는 뜻이고, `PLANNED` 제품 또는 지원하지 않는 item/activity는 주문 봉인을 거절한다. P13/P14/P20의 다지문·표/그래프·별도 조판을 수능 선택지에 끼워 넣지 않는다. 각 제품군의 생산 E2E가 확인되기 전 `PRODUCTION_READY`로 표시하지 않는다.

## 원천 라우팅과 증거

`routeFactorySource`는 기존 source role과 기사별 상업 이용·파생·AI·제3자·ShareAlike 권리, 품질, 원문 목표 적합성을 받아 `DIRECT_USE / ADAPT_REQUIRED / ADAPT_OPTIONAL / REFERENCE_ONLY / DISCOVERY_ONLY / REJECT` 중 하나를 반환한다. 원문 적합성이 미측정이면 직접 사용이나 각색을 추정하지 않는다. 이 함수는 권리의 진위를 인증하지 않으며 실제 원문 검토의 입력 계약이다.

`bindFactoryEvidence`는 source ID/hash, rights·trust·evidence policy hash, 주문 ID/revision/hash, 제품 capability hash, target hash, adaptation hash, benchmark version/snapshot hash, certificate hash를 한 판으로 결속한다. 현재 판과 다른 필드 하나라도 있으면 `stale`, 권리 철회면 `invalidated`다. 인증서나 benchmark가 없는 상태를 0점으로 만들지 않는다. 동일 source의 중1·고1 주문은 서로 다른 주문·target·evidence hash를 갖는다.

`planFactoryImpact`는 source→passage→item→explanation→unit→volume→render 의 dependency graph에서 변경된 행과 모든 자손의 `stale`/`invalidated` 계획을 만든다. 동일 원문을 공유하는 중1·고1은 원문 변경 시 둘 다 영향받고, 중1 각색만 바뀌면 고1은 유지된다. 누락 parent·다른 주문의 비원천 parent·순환은 오류로 멈춘다. 이 함수도 읽기 전용이며 DB 상태 전파·발행 중단은 후속 구현이다.

## 공정과 전이의 경계

`FACTORY_STATE_STAGE`는 주문 증거 상태를 기존 `factory-model.ts`의 9공정에 연결한다. 화면이 숫자나 통과 여부를 이 매핑에서 추정하지 않는다. `planFactoryTransition`은 같은 판의 증거와 인접 단계 및 직접사용/각색 분기만 검사하고 `{ proposed_state, required_gate, authorized:false }`를 반환한다. 임의 인증서 hash만으로 Gold-S를 인증할 수 없도록 **상태를 실제로 전이하지 않는다**. 각 게이트의 현재 증거 검증은 해당 운영 모듈이 책임진다. 직접 사용은 별도 내용 검토·benchmark 뒤 기존 ready 원문의 재확인을 요구하며 새 DB 승격을 주장하지 않는다. 실제 `reading:` 자식은 현재 DB 트리거에 의해 `queued`에 머물며, 별도 승인된 승격 계약·migration 이전에는 생산 라인에 편입되지 않는다.

직접 사용 경로의 실제 DB·문항 생산 연결, 발급자 신원, Gold-S 심사, 시중 교재 실분포, 문항→해설→권 조판의 주문 ID 전파, 관리자 조작 화면은 후속 Phase 범위다. Phase 1의 기능은 공통 용어·증거 결속·실패 폐쇄를 제공하는 것이며 전체 공장 E2E 완료를 뜻하지 않는다.
