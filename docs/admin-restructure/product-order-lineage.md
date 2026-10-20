# Product Order 계보 계약과 구현

2026-10-20 · T-0057 로컬 구현 이후 사용자가 공유 DB 적용을 별도 승인했다. 개발 DB에 `20261020063000`을 적용했으며 사후 검증 9개와 예정된 카탈로그 73객체 추가를 확인했다. [실제 적용·권한 안내·남은 검증](product-order-lineage-deployment.md). 실제 주문·납품과 populated 화면 검증은 아직 없다.

## 기존 구성과 변경

| 항목 | 기존 | 재설계 |
|---|---|---|
| 발행 주체 | admin 봉인 API와 admin/curator 등록 초안이 분리 | admin만 정본을 등록·철회·연결, curator는 조회. 자동 발행 없음 |
| 정본 | 문자열 ID/revision/hash만 저장하는 초안 | 기존 Factory sealer로 검증한 전체 주문과 정확한 정규 문자열·SHA-256 보존 |
| 개인 요구 | TASK·역할만 비교 | 수요 서명·줄·주문·PLAN/목표/정의 revision과 줄의 조건을 결속 |
| 공용 규격 | production-share/2는 정확한 부족량까지 포함한 후보 그룹 | 별도 lineage-spec/1: 정의·TASK·역할·유형·조건을 비교. 개인 ID·메모·수량 제외 |
| 수량 | quantity의 단위와 배분 의미 미정 | item 단위의 계획 목표. 한 개인 주문의 현재 연결 합계는 개인 요청 이하. 공용 자료는 재사용되므로 학습자 간 합산 소모하지 않음 |
| 생산·납품 | 연결을 생산 진척으로 오인할 가능성 | 계보는 계획 연결. 적합성·환산·생산 실행·출시·개인 납품은 별도 검사 |

## 확정 계약

1. canonical 주문은 안정 커밋 `663f2eee821b82b47da106b917f5449b5946b927`의 `factory-order.ts`와 `product-planning.ts`를 필요한 의존 5개와 함께 그대로 재사용한다. 새 제작 엔진이나 전역 후보 crosswalk 승격은 하지 않는다. JSON 객체 키 정렬·배열 순서 보존·고정 sealed_at이 해시의 일부다. registry v1은 DB에서도 동일 바이트를 검증할 수 있도록 숫자를 안전한 정수, 객체 키를 ASCII로 제한한다. 더 넓은 Factory 주문은 등록 전에 명시적으로 거절하며 변환하지 않는다.
2. 등록 envelope는 정본 바깥에 둔다. 주문 원문, 정규 문자열, 해시, spec, item 계획 수량, 사유, 요청 UUID를 받는다. DB가 정규 문자열·해시·주문 ID/revision을 재검사한다. admin의 명시적 규격 연결 판단을 기록하며 자동 적합성 판정으로 사용하지 않는다. 정책 hash 형식 일치는 실제 승인이나 현재성을 뜻하지 않는다.
3. 공용 spec은 `{schema:'vf.factory-lineage-spec/1', definition, task, role, types, keys, requires}`다. types/keys는 정렬·중복 제거, requires는 원래 구조를 보존한다. 이유·개인 ID·목표/PLAN·수량은 공용 spec에 넣지 않는다. spec SHA-256 전체 64자리를 사용하며 기존 production-share/2를 대체했다고 표시하지 않는다.
4. 링크 RPC가 저장된 개인 수요 정본에서 spec을 다시 계산한다. 클라이언트가 제출한 수요 서명·공용 주문 해시와 대조하며 브라우저가 제출한 spec은 사용하지 않는다. 개인 스냅샷은 demand signature·line/order·goal/PLAN/definition·order quantity·연결 당시 상태를 저장한다. 현재 Workspace/PLAN/목표가 달라졌거나 주문이 닫혔으면 새 링크를 거절한다. 과거 링크는 보존한다. 정의 변경은 새 수요·spec으로 연결하며 기존 스냅샷을 덮어쓰지 않는다.
5. quantity는 **distinct item 계획 목표**다. 공용 주문별 목표 이하로 각 개인이 배정받으며, 개인 주문의 현재 active revision 연결 합계도 개인 quantity를 넘지 않는다. 동일 자료를 여러 사람이 사용할 수 있으므로 사람 수를 곱하거나 공용 목표에서 차감하지 않는다. item→cell/unit 환산·실제 수율·납품 수를 추정하지 않는다. 실제 산출물 적합성은 기존 자격/승인/노출 검사에서 판정한다.
6. 동일 product_order_id의 새 revision은 직전+1, 다른 본문·해시로만 등록한다. 새 revision으로 이전 연결은 역사 기록이 되고 현행 배정 합계에서 빠진다. 철회는 별도 추가 전용 원장으로 정확한 revision/hash에 결속하며 새 링크를 막는다. 철회한 revision은 재활성화하지 않는다. 재발행은 새 revision이다.
7. 멱등은 호출자·요청 UUID·**전체 본문** 일치일 때만 같은 결과다. 다른 UUID로 같은 링크를 보내도 새로운 배정을 만들지 않으며 그 UUID도 별칭 영수증으로 보존한다. 동일 UUID의 다른 action/행위자/수량/사유/주문/해시는 거절한다. 요청 UUID → 개인 order 행 → product ID 순서로 잠가 경쟁·과배정을 막는다. 등록·철회는 UUID → product ID만 잠근다.
8. 네 표(등록·연결·철회·요청 영수증)는 append-only/RLS이며 학습자는 0행, curator는 조회만, admin만 서버 API에서 쓰기를 요청할 수 있다. 직접 표 DML/TRUNCATE는 service_role에서도 금지하며, RPC는 신뢰 서버의 service_role만 실행한다. 일반 관리자 JWT로도 RPC를 직접 실행할 수 없다. superuser/객체 소유자는 별도 복구 신뢰 경계다. GUC는 권한 증명이 아니다.
9. 자료 역할 6개를 모두 지원한다. independent_check/transfer/delayed_check의 구조 계보도 기록하지만 공장 생산 적합성이나 평가용 승인으로 해석하지 않는다. gold/unseen 등 개인 조건은 spec에 그대로 결속하고 실제 D2가 다시 판정한다. 기존 `productionNeed`의 평가 역할 차단·후보 crosswalk·환산표 공백은 변경하지 않는다.

## 화면·프로세스

등록·연결·철회·조회 RPC는 서비스 역할을 가진 **서버 게이트만** 실행한다. 서버는 기존 관리자 인증/상태 검사 후 역할을 확인하고 원문을 기존 Factory sealer로 검증한다. DB는 전달된 행위자의 역할·상태와 계보/해시/수량 불변식을 다시 확인한다. 서비스 역할 보유자는 신뢰 서버 경계이며 행위자를 임의 지정할 수 있으므로 키를 브라우저에 노출하지 않는다. Factory 의미 검증은 신뢰 서버의 책임이고 DB의 정규 바이트 검사만으로 이를 주장하지 않는다.

다른 UUID로 같은 자연키를 재전송할 때도 행위자·수량·사유·해시·개인 수요 서명의 전체 본문을 비교한다. 같으면 역사 ID를 반환하고 다르면 거절한다. 새 PLAN/철회/개정 후 재전송도 역사 사실일 뿐이다. 응답은 `current: read_required`이며 조회는 `current/withdrawn/superseded/personal_order_changed`를 구분한다. 기록 성공을 현재 사용 승인으로 표시하지 않는다.

기존 개인 Workspace 수요·공급 화면에 주문 계보 조회를 연결한다. 등록/연결/철회는 admin API에서 정본과 전체 본문 검증 후 서비스 RPC를 호출한다. 임의 로컬 파일 경로나 실행 상태 문자열을 생산 증거로 받지 않는다. DB 미설치는 빈 목록·완료 대신 ‘계보 미설치’로 표시한다. 공유 사용자 명단은 학습자 화면에 노출하지 않는다. 개인 배정을 잘못했다면 기존 주문 상태 전이로 해당 개인 주문만 보류/실패 처리하고 새 개인 주문으로 다시 연결한다. 과거 링크는 유지하며 공용 주문을 철회해 다른 학습자까지 무효화하지 않는다.

공용 주문 등록 → 개인 수요와 조건 일치 확인 → 계획 수량 연결 → 기존 Factory 생산/검수 → 기존 출시 승인 → 학습자별 납품 재검증. 연결 단계 자체는 비용 발생·생성·발행을 실행하지 않는다.

## 검증 및 적용

격리 PostgreSQL 다중 연결에서 정본 변조·spec 불일치·PLAN 개정·권한·멱등·과배정·revision/철회 경쟁·개인정보 격리를 확인했다. 새 SQL은 기존 DB1/DB2에 섞지 않았다. 기존 DB1/2를 재적용하지 않으며 D3만 별도 SHA와 카탈로그 diff로 제시했다. 로컬 구현 단계는 실제 DB 읽기만 수행했고, 이후 별도 사용자 승인으로 D3를 적용한 상태다.

적용 전 SQL 전체·SHA-256·변경 객체·선행 지문·복구안을 제시한다. 이번 승인 후 checkpoint before/after와 실제 카탈로그 diff를 수행했다. 데이터가 생긴 뒤 복구는 기능 중지와 읽기 보존을 우선하며 DROP/삭제는 별도 승인 없이 하지 않는다.

정본 SQL은 [d3.sql](../../scripts/db/factory-i1/d3.sql), 승인용 전체 SQL은 [apply.sql](../../scripts/db/factory-i1/d3-package/apply.sql), 정확한 바이트 해시는 [MANIFEST.json](../../scripts/db/factory-i1/d3-package/MANIFEST.json)이다. `node scripts/db/factory-i1/d3-package.mjs --check`로 재생성 동일성을 확인한다. 생성기는 DB 접속·apply 기능이 없다. 기존 DB1/2 승인 러너의 stage를 임의로 재사용하지 않는다. 실제 적용은 프로젝트/포트/TLS·196개 선행 지문을 확인한 뒤 기존 `apply-approved-sql.mjs`에서 전체 SQL SHA를 대조해 수행했다. [버전 파일](../../supabase/migrations/20261020063000_factory_product_order_lineage_v1.sql)은 적용 이력에 기록된 정본과 동일 바이트다. 재적용하지 않는다.

검증: 재사용 Factory 회귀와 관리자 앱 회귀, 격리 PostgreSQL 23검사(요청 UUID 별칭·6역할·실제 닫힘·개정/철회↔링크 양방향 경합·원자성·선행 지문 차단·이력 원문·비파괴 쓰기 정지·누락 이력/RPC의 명시적 검증 실패 포함)를 사용한다. 격리 카탈로그 변화는 추가 73개·기존 변경/삭제 0개다. 실제 공유 DB 성공이나 정책·crosswalk 승인 증거는 아니다.

PC 표시 검증은 실제 `ProductOrderLineageView`와 빌드 CSS를 고정 fixture로 렌더한 영구 하네스 `d3-ui-check.mts`를 사용한다. 공유 DB에 표시 가능한 저장 Workspace가 없어 실제 populated 계보 화면 검증이라고 주장하지 않는다. 미설치/실패/빈 목록/현재·과거 4상태에서 키보드·44px·넘침·axe를 확인한다. 캡처에서 접힘 표식이 보이지 않아 기존 ChevronDown을 추가했다. 외곽은 기존 `admin-ref-compare.mjs`로 PC 1440×900을 대조했다.

| 프레임 항목 | 참조 | 적용 | 차이 |
|---|---:|---:|---:|
| 상단 높이 | 56 | 56 | 0 |
| 레일 너비 | 216 | 216 | 0 |
| 패널 x | 228 | 228 | 0 |
| 패널 y | 58 | 58 | 0 |
| 패널 너비 | 1200 | 1200 | 0 |
| 패널 최소 높이 | 830 | 830 | 0 |

이 표는 외곽 프레임 측정이며 화면 전체의 픽셀 일치를 뜻하지 않는다. 프레임 검증은 개발 전용 bypass와 빈 브라우저 상태로 실행했으며 프로덕션 인증 양성 검증은 API mock/격리 DB 역할 검증과 구분한다.
