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

## Phase 2 — reading 자식의 제한된 승격 계약

`scripts/textbook/reading-promotion/preflight.mjs`는 현재 DB의 부모와 queued 자식을 다시 읽은 뒤 Product Order·target·source/rights·독립 내용 검수·각색 본문·benchmark snapshot·서명된 Gold-S/seed eligibility·운영 trust policy를 같은 요청으로 결속한다. 외부의 현재 trust policy 파일을 실행 전과 RPC 직전에 재확인한다. `run.mjs`의 기본값은 dry-run이며 `--packet`은 본문을 포함하지 않는 승격 요청을 저장소 밖에 새로 만든다. 이 패킷의 `request_id`, order ID/revision/hash, evidence hash, certificate/eligibility hash를 책임자가 검토한다. 동일 원천과 target이라도 다른 Product Order의 승격에는 **새 요청과 독립 승인**이 필요하다.

Migration `20261007120000_reading_controlled_promotion.sql`은 승인 후 개발 DB에 적용했다. 활성 trust/benchmark 판본과 Product Order revision registry가 비어 있으므로 실데이터 승격은 닫혀 있다. 실제 benchmark 검증 결과와 최신 trust policy/철회 목록을 확인한 관리자가 증가하는 generation으로 authority 판본을 등록하고, 각 Product Order의 revision/hash를 등록한다. 이전 order revision으로의 rollback, 같은 revision의 다른 hash, 과거 authority 판본 재사용, 철회 목록 제거는 거부한다. 별도 관리자 승인 RPC는 요청 전체를 특정 order/evidence에 묶어 15분짜리 승인 행을 만든다. service_role 실행기는 승인 행을 생성하거나 변경할 수 없다. 전용 승격 RPC는 부모·자식 행과 authority·order registry·승인을 잠그고 현재 본문·권리·판본·철회를 다시 확인한다. 성공할 때만 감사 행, 일회용 DB permit, `queued → ready`, 승인 소비를 한 트랜잭션에서 수행한다. 오류는 전체 rollback된다. 같은 request ID와 동일 패킷의 재호출도 현재 증거를 다시 확인하며, 다른 내용·다른 주문은 충돌이다.

기존 일반 ACP, 관리자 강제 게시, 직접 UPDATE는 일회용 permit이 없어 계속 차단된다. DB는 Ed25519 서명을 직접 검증하지 않는다. 서명 검사는 실행기에서 수행하고 DB는 이전 seed에 저장된 Gold-S 투영·별도 관리자 승인·활성 authority 판본·현재 행을 검증한다. 이 경계를 벗어난 service_role 자격 증명의 탈취나 관리자에 의한 허위 authority 등록은 별도 운영 통제 대상이다. registry의 정책·benchmark 판본을 변경하거나 철회를 등록하면 이전 요청의 승격은 실패한다. registry 등록은 실제 corpus와 Gold-S가 없을 때 금지한다.

운영 순서는 `외부 요청/정책 파일 준비 → dry-run + 외부 packet 저장 → 관리자 authority 판본·order revision 등록 → 관리자 order별 승인 → --commit + 외부 append-only audit → DB audit와 ready 상태 재조회`다. authority registry가 승격에 사용할 **현재 정책·benchmark·철회 목록의 정본**이다. 폐기·정책 변경 시 registry를 먼저 올려 이전 승격 요청을 닫고, 외부 정책 파일을 같은 판본으로 갱신한다. 응답이 끊기면 request ID로 DB audit를 먼저 조회한다. 이미 commit된 동일 요청도 현재 권리·판본을 확인하고, 감사 행이 없으면 현재 증거부터 다시 검사한다. 개발 DB 합성 검증은 `scripts/textbook/reading-promotion/db-smoke.sql`에서 전체 롤백으로 성공·차단·재시도를 확인했다. 현 상태는 corpus 0, Gold-S 0, DB seed 0, 실데이터 promotion 0이다.

Migration 검토 기록: 신규 테이블 5개(`reading_promotion_audit`, `permit`, `authority`, `approval`, `reading_product_order_revision`), 기존 reading 트리거 교체, 관리자 RPC 3개와 service_role 승격 RPC 1개가 대상이다. 기존 행을 일괄 수정하지 않았다. 적용 실패 시 migration transaction 전체가 롤백된다. 되돌리려면 승격 실행을 중지하고 신규 RPC 4개·테이블 5개를 제거한 뒤 `20261007102816`/`20261007102922`의 차단 트리거 정의를 복원해야 한다. 이미 `ready`로 승격한 행은 자동으로 queued로 되돌리지 않고 감사 행별로 별도 판정한다. 적용 전후 checkpoint `reading-promotion-20261008`을 기록했고 합성 검증 후에도 audit·authority·approval·order와 synthetic article은 0건이었다.

5개 승격 증거 테이블의 RLS는 승인받은 `20261008060000_reading_promotion_tables_rls.sql`로 개발 DB에서 활성화했다. anon/authenticated의 직접 접근 권한은 없고, service_role은 permit 외 4개 테이블의 SELECT만 유지한다. postgres 소유의 관리자·승격 RPC와 트리거는 RLS 우회 신원/증거 검사 경로를 유지하며, 적용 후 롤백형 DB 스모크가 통과했다. RLS 적용 전후 checkpoint는 `reading-promotion-rls-20261008`이다. policy가 없어 기본 거부이지만 Security Advisor에는 이 5개 테이블의 `rls_enabled_no_policy` INFO가 새로 표시된다. 명시적 restrictive deny policy는 별도 migration·승인 대상으로 둔다. RLS만 되돌릴 경우 승격을 중지하고 5개 테이블의 `DISABLE ROW LEVEL SECURITY`를 한 트랜잭션에서 실행한 뒤 ACL·RPC·스모크를 확인한다.
