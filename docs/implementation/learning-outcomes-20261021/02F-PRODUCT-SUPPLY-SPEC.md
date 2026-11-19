<!-- docs/implementation/learning-outcomes-20261021/02F-PRODUCT-SUPPLY-SPEC.md -->
# 2F — 공장 연습 자료의 실제 공급 호출부

## 발견과 목표

2E 이전 검색에서 admitCandidates는 관리자 API 호출부가 있었으나 approveForGuidedPractice/receiveForLearner는 테스트 밖 호출부가 없었다. 받은 자료 열기만으로 요구→주문→공급의 제품 경로 완료라고 하지 않는다. 실제 로그인 학습자의 현재 Workspace 계획에서 안내 연습을 요청하고, 실제 관리자에 의해 연결·승인된 자료만 수령하는 경로를 만든다. 공유 DB 적용은 별도 승인이다.

## 흐름

1. 기존 Workspace FactoryDcpCard에서 `공장 연습 자료 요청`을 누른다. 서버는 현재 본인의 저장 계획→composeV4→buildDemand를 사용한다. 클라이언트가 user/goal/quantity/qualification/approval을 지정하지 않는다. 지원은 r.central_meaning 안내 연습의 실제 3활동 청사진이다. 해당 단계가 아니면 이유를 표시한다.
2. 학습자 세션 workspace_demand_record로 정본 수요를 기록하고 guided_practice 줄을 찾는다. 기존 유효 납품/주문을 확인하고 부족분에만 실제 factory_order_open을 호출한다. 같은 요청 재전송·부분 성공·응답 유실은 같은 키/행으로 복구한다.
3. 실제 관리자 제품주문 링크가 이미 있는 주문만 공급한다. 기존 D3 admin 제품주문 연결 화면/API를 재사용한다. 링크가 없으면 요청한 주문을 보존하고 `제작 연결 대기`를 표시한다. 학습자 요청을 관리자 actor로 위장하거나 service_role이 admin을 임의로 선정하지 않는다. receiveForLearner의 ProductLinker는 이 경로에서 기존 정확한 링크를 읽어 확인하는 read-only callback이다.
4. 현재 source/revision·같은 product_order/hash·guided role/task·현재 qualification+public approval·미철회인 승인된 후보만 선택하고 기존 receiveForLearner→workspace_delivery_record로 본인에게 공급한다. DB가 최종 계보/현재성/수량을 잠금 아래 재검증한다. 같은 세트의 요지→제목→주제 순서가 완성 가능한지 확인하고 다른 원문의 문항을 섞지 않는다. 소유권 없는 ID/오래된 링크/철회된 판본은 공급하지 않는다.
5. 관리자 승인 호출부는 기존 /api/admin/csat/dcp-admission에 명시적 `approve` 동작 또는 별도 인접 route로 제공한다. 실제 관리자 세션만 approveForGuidedPractice를 호출한다. qualification_id를 서버에서 factory_dcp_qualification→factory_dcp_admission에 결속해 다른 artifact/assessment 승인을 금지한다. preview/admit가 자동 release 되지 않는다. 현재 정책/본문/자격 상태를 재확인한다. 큐레이터 권한은 현행 content_release_approve 계약보다 넓히지 않는다.
6. 성공 후 카드 목록을 새로 불러오고 실제 전달된 첫 요지 학습 링크를 보여준다. 기다림과 실패를 0개/완료로 삼키지 않고 구분한다. 지원하지 않는 source_analysis/model_explanation 줄을 완료한 것처럼 만들지 않는다.

## 수용

실제 API→공급 서비스→PGlite 정본 SQL로 신규 요청·관리자 실제 승인/기존 D3 링크·수령·학습/설명·기존 2E 재평가 연결을 검증한다. 인증 경계만 시험용 사용자로 주입하며 승인/수령 함수를 대역으로 대체하지 않는 통합 사례를 최소1개 둔다. 다른 사용자·오래된 목표/계획·대기 링크·철회·잘못된 qualification·같은 재시도/부분수령·DB 오류 반례를 잠근다. PC1440 카드 브라우저 흐름과 잘못된200 응답을 확인한다.

기존 2E 파일은 필요하면 인접 통합 시험으로 재사용하되 잠금 단일 작성자를 지킨다. 새로운 SQL은 피한다. API/도움말/라우트/모듈/CHANGELOG를 함께 고친다. 실제 API request origin+JSON/UTF8크기/닫힌 입력/no-store를 지킨다. analytics는 기존 닫힌 이벤트 등록 패턴을 쓴다. <30파일. 실제 공유 DB 쓰기·출시·적용·push 없음. 검증 결과 PASS/NOT_RUN을 구분하고 사람 대기 없음.
