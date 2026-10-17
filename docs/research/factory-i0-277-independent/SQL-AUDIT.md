# 미적용 C/B/delta 안전 감사

상태: 감사 수행 PASS, 실제 적용/원자성/RLS/납품 NOT_TESTED · BLOCKED_APPROVAL. SQL 파일을 변경하거나 적용하지 않았다. 2026-10-17T08:16:42Z 읽기 전용 to_regclass에서 content_qualification/content_release_approval/workspace_content_demand/factory_order/workspace_content_delivery/factory_order_product_link가 모두 null이었다.

## 추가 I1 적용 차단 P1 — NULL 검수 우회
C의 fq_axes_valid는 축 state 누락으로 생긴 NULL을 bool_and가 무시할 수 있다. C content_release_approve 및 B workspace_delivery_record의 if not fq_role_ok는 결과가 NULL이면 거절문을 실행하지 않는다. A={}이고 나머지 일곱 축 pass인 합성 JSON을 원문과 같은 읽기 전용 식으로 평가해 axes_check=true, role_check=null, if-not 분기=continue를 확인했다. 실제 함수를 설치하거나 승인 행을 쓰지는 않았다.

I1 수정 사양: 각 축의 state 표현식과 전체 결과에 IS TRUE/COALESCE(...,false)를 적용하고, 승인/납품의 거절 조건은 fq_role_ok(...) IS NOT TRUE로 쓴다. A/E 결속 CHECK도 state/빈 문자열/누락을 명시 검사한다. 누락/JSON null/비객체/잘못된 state별 격리 회귀가 필요하다. 이 문서는 수정 SQL의 승인이나 적용을 대신하지 않는다.

## 기존 적용 차단 사유 재확인
- B supply_learner_exposure는 csat_dx_response/session만 보아 G2 learning_task_attempts와 해설 learning_sessions를 누락한다. delta D1은 두 경로를 제안하지만 아직 적용되지 않았다.
- B는 승인 한 행을 받아 교수 역할의 scope를 확인하지 않고, 평가에는 assessment만 요구한다. 앱은 public + 평가 시 assessment를 요구한다. delta D2는 실행 가능한 함수 교체가 아니라 주석 교체 지침이므로, 그 파일 실행만으로 승인 결함이 고쳐진다고 할 수 없다. 최종 I1 적용 묶음 작성/해시/검증이 필요하다.
- supplyFor의 teaching=null 해설 available과 실제 D pass 공급은 다르다. I0 해결기는 D를 요구하지만 기존 화면을 바꾸지 않았다.
- delivered 전이는 해당 주문에 공급 행 한 개가 있으면 가능하며 전체 주문 수량 충족을 검증하지 않는다. 부분 납품/잔여 부족량 의미와 재주문 정책은 I1 결정이다.
- 공용 Product Order의 revision/hash N:M 계보는 delta D3 제안 표까지이며 실제 원장/reader/권한 검증이 없다.
- B artifact revision은 산출물 내용 일부를 보며 현재 analysis/Gold 원장을 전부 재대조하는 구현이 아니다. 실제 서버는 현재 source/analysis/Gold/권리/승인을 재검증해야 한다.

## SECURITY DEFINER · 소유권 · RLS 정적 결과
C 기록/승인/철회와 B 관리자 전이는 auth.uid 및 is_admin_or_curator를 검사한다. 수요/주문/납품은 auth.uid를 사용하며 학습자 소유 Workspace/목표/PLAN의 복합 FK와 본인 조건을 둔다. 표에는 RLS, 학습자 본인 또는 관리자 SELECT 정책이 있고 직접 DML을 회수한다. exposure/revision 내부 함수는 public/anon/authenticated 실행권을 회수한다. search_path=public을 명시한다.

이 코드를 읽었다는 사실은 실제 GRANT/RLS 우회·search_path 안전성·정의자 함수 동시성의 실행 검증이 아니다. public 스키마 CREATE 권한/함수 소유자/권한 상속과 익명·타인·철회·동시 호출을 격리 Postgres 및 승인된 실제 I1 환경에서 확인해야 한다. GUC writer 표시는 인증 수단이 아니고, 트리거 깊이 DELETE 예외도 FK cascade만 인증하는 증거로 보지 않는다.

## 원본 hash
C dd940568ef7170212bf23ac9f7fb89bb090e8f529eeb4c26bb9ccdbc1e503f66
B e3f929d06f20518495682a36e0d1f8f483988f2a39feabd3e5d490c02a5293b2
delta db33188031b3043daa5b301bcf7bb128d0459cf1d0254055573e103db95e4e20

I0 CONTRACT_ONLY 수용과 이 SQL의 적용 승인은 별개다. 위 blocker를 해소하기 전 I1 적용·실제 공급으로 진행하지 않는다.
