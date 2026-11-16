<!-- docs/implementation/learning-outcomes-20261021/01C-SUPPLY-SPEC.md -->
# 1C — 원문 파생 DCP 후보 등록과 Workspace 공급

기준 `65e2613bf` · L3 구현/격리 검증, 공유 DB 적용 L4는 별도 승인. 1A·1B의 실제 공장 경로를 확장한다.

## 목표

현재 원문과 정확한 AI 검수 판본을 확인한 제작물을 기존 `csat_dcp_items`에 후보로 등록하고 기존 자격·승인·Workspace 공급 RPC에 연결한다. 내용 검수·교사·Gold 판단은 Claude/Codex가 담당한다. 사람 검수 대기를 만들지 않고 기존 사람 검수 문구에 AI를 사람이라고 기록하지 않는다. 운영 승인/공유 DB 적용 권한은 별개다.

원문 파생물은 `authored_item`이 아니다. 1B 문항은 `article`의 topic/title/main_point, guided_practice만 지원한다. 정답만 맞힌 연습을 R5의 완전한 독립 확인으로 간주하지 않는다. 후보 등록·자격·출시 승인·학습자 납품은 각각 별도 사실이며 실패 시 완료로 표시하지 않는다.

## 구현 경계

1. `factory-bridge/dcp-admission.ts`: 기존 1B 검증을 실제 재사용한다. 원문은 DB에서 현재 행을 읽고 `evaluateSource`로 다시 판단한다. 본문·metadata digest·주문·packet·출력 판본이 바뀌면 과거 검수를 상속하지 않는다. 등록 계획에 원문 id, type, 5선지, stem_ko, answer_key, source/task/role/order/packet hash와 AI 검수의 정확한 대상 hash를 결속한다.
2. `factory-bridge/dcp-supply.ts`: Supabase 경계. 관리자 세션이 인증된 등록을 담당하고 학습자 본인 세션이 기존 `factory_order_open`/`workspace_delivery_record`를 호출한다. 관리자 service_role이 auth.uid를 바꿔 학습자를 흉내내지 않는다. 기존 `factory_product_order_register`/`factory_order_link_product`의 서명·책임도 확인한다. 실제 저장 주문이 없는 합성 준비본은 실등록을 거절하고 격리 시험에서만 사용한다.
3. 필요한 최소 SQL은 `_pending_factory_dcp_admission.sql`로 작성해 **격리 PGlite에만** 적용한다. 적용된 기반 C/B/I1/annotation SQL의 권한·안전 계약을 퇴행시키지 않는다. 후보 insert와 영수증은 원자적·멱등이며 동일 요청 키 다른 본문은 거절한다. 기존 문항 unique(kind,ref_id,type,paragraph_idx) 충돌 시 덮어쓰지 않는다. 무검수·무권리·합성 정책을 자동 승인하지 않는다. AI 검수 기록은 사실상 AI라고 남기고 각 필수 축을 근거 없이 pass로 만들지 않는다. 가능하면 기존 자격/승인 RPC를 재사용하고 별도 새 자격 체계를 만들지 않는다.
4. 실제 호출부는 기존 `scripts/textbook/factory-production-local.mts`에 `admission-plan`(읽기/파일만)을 추가하거나 기존 실행 경계에 최소 확장한다. 기본 dry-run이며 승인 없는 공유 DB 쓰기를 넣지 않는다. 후보 계획은 출시/납품을 의미하지 않는다. CLI를 추가하면 scripts tsconfig 검증에 들어가야 한다.
5. `__tests__/dcp-admission.test.ts` 및 `dcp-supply.pglite.test.ts`: 실제 core와 실제 SQL로 등록→검수→기존 승인→학습자 공급→조회까지 격리 연결한다. 외부 DB 연결/환경 키/공유 계정 생성은 사용하지 않는다. test auth stub는 격리 하네스에서만 사용한다.

AI 검수 포맷은 대상별 source/output/order/role/TASK hash, 판단 역할, 세션, 결론, 근거, limitations를 갖는다. 임의 JSON의 accepted:true가 권한을 만드는 구조는 피한다. 서비스는 관리자 인증을 실제 경계로 사용하고 검수 참조를 재검증한다. 현재 권리 근거가 부족하면 후보만 생성하고 공급은 명시적으로 보류한다. 저장소 내 이전 `_pending_authored_supply.sql`의 literal human-reviewed는 우회/변조하지 않는다.

## 수용 기준

| AC | 검증 |
|---|---|
| C1 | 실제 1B 검증→DCP 행 변환, 기존 데이터 형식과 렌더러/정답키 일치 |
| C2 | current source 변경/archived/blocked, stale output/검수 hash, wrong task/role/order, synthetic 실등록 거절 |
| C3 | 관리자/학습자 권한 분리, 다른 사용자·닫힌 Workspace·구 goal/plan 거절, 명시적 line/order |
| C4 | 실제 SQL 격리 등록·승인·납품 정상 경로, 재요청 멱등·본문 충돌·중간 오류 롤백 |
| C5 | 무승인/철회/미검수/원문 변경은 공급 거절; 실패를 0/완료로 삼키지 않음 |
| C6 | 관련 기존 supply 회귀·새 테스트·웹/scripts 타입·lint 통과, unrun 별도 |

## 하지 않을 것과 다음 단계

새 독해 목표 표·새 전체 프레임워크·전역 crosswalk 승격·사람/실학생 성과 주장·DB 실제 적용·push/merge 없음. 기존 파일은 다른 작업자가 있을 수 있으므로 자신의 경계만 수정하고 타인의 변경을 되돌리지 않는다. 구현 중 계약 불일치가 있으면 같은 문서에 실제 원인과 해결을 남긴다. 불필요한 가드·공정 확대 없이 다음 1D는 명시적 delivery 결속과 수행→재계획, 단계 2는 구조/자기설명 교수활동, 단계 3 FAST, 단계 4 맹검 AI 비교다.
