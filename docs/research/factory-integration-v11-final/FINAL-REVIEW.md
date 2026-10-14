# Factory Integration v1.1 — 최종 독립 수용 판정

2026-10-15. **최종 계약 수용은 FAIL입니다. 연계 설계 범위를 아직 종료할 수 없습니다.** 세 fixture 정정은 ACCEPT했고 정정 입력82/82 PASS를 재현했습니다. 그러나 추가 정상·공격 검증에서 신규 P1 두 그룹이 남았습니다. 새 공장 개발이나 콘텐츠 연구는 시작하지 않았습니다.

검토 main은 **6ddd1909a761d942c74f68a12d189518e2c1858e**, PR265 수정 HEAD는 **8af914add3d7efa845e645b798a1ae8284a8a5b8**입니다. MERGED 상태와 해당 HEAD의 CI를 GitHub에서 확인했습니다. 필수 문서·코드·보류 SQL·호출부·회귀 설정21파일의 PR/main blob이 같았습니다. [해시 원장](data/revision.json)에 보존했습니다. 최초 검토 commit8e705307b의82행과 기존 무결성 원장은 변경하지 않았습니다.

## 세 게이트

| 게이트 | 판정 | 증거와 한계 |
|---|---|---|
| A 형식·안전성 | **FAIL** | 정정82는 PASS지만, 추가46개 진단 중4 FAIL로 신규 P1 두 그룹 재현 |
| B 기존 제품 회귀 | **HOLD** | 원본19·wire7·PR verify/build/isolated e2e PASS. R5 정적 경로 변경 없음. R5 전용 browser6/6의 보존 artifact는 독립 확인하지 못함 |
| C 실제 공장 연결 | **MOCK_ONLY / NOT_CONNECTED** | 주문 API·실제 manifest·활동 생산·서버 reader 없음. PASS로 승격하지 않음 |

Gate B의 HOLD는 화면 중단이 재현됐다는 뜻이 아닙니다. TaskInspector→supplyFor 경로는 새 EXISTING 래퍼를 호출하지 않습니다. 관련 화면·라우트·supply·demand·v4 파일도 바뀌지 않았습니다. 다만 PR isolated e2e의 map-goal/csat-v31 성공을 R5 전용6건의 결과로 대체하지 않았습니다. shared-dev E2E의 SKIPPED도 PASS로 세지 않았습니다. [회귀 증거 범위](data/regression-scope.json)를 참조합니다.

## 최초·정정·추가 결과

| 원장 또는 시험 | 결과 | 의미 |
|---|---|---|
| 역사 최초 r1 82 | 42 PASS / 40 FAIL | 그대로 보존 |
| 원본 입력→v1.1 | 79 PASS / 3 FAIL | 실패는 지정된 G3개뿐 |
| 독립 정정 r2 82 | 82 PASS / 0 FAIL | 기대값·safe predicate 유지,3개만 입력 보강 |
| Claude 정정82 | 82 PASS | 독립 정정과 입력 결속 동일 |
| 원본 계약 회귀 | 19/19 통과 | 수정 HEAD에서 별도 실행 |
| 표준 JSON/Schema | 7/7 통과 | 실제 외부 공장 consumer/API 시험 아님 |
| 추가 정상·공격 진단 | 42 PASS / 4 FAIL, 총46 | 정상 trusted 경로에서 P1 두 그룹 재현 |

진단용 Vitest 통과는 실행과 봉인 출력 재현을 뜻합니다. 최종 안전성은 행별 기대조건과 신규 반례로 결정합니다. 반복 실행 횟수를 독립 문항·학생 수로 합산하지 않습니다. 실제 생산·납품·제품 브라우저 신규 실행·학생 효과 실험은0입니다.

[입력 정정 판정](FIXTURE-CORRECTION.md)에서 기대 문구·판정 함수82개 불변, 최신 코드에서 생성한79개 검사 입력 불변을 자동 확인했습니다. ID-only 판정은 여전히0입니다. source/analysis/Gold/hash/current revision 변이도 실제 trusted 대조에서 차단됐습니다. 최초 stale와 정상 대조가 문자 그대로 동일한 함수 입력은 아니지만, 근거 없는 ID-only 판정을 긍정·부정 대조에 같이 사용한 전제 결함은 있었습니다. subject를 추가하고 평가 role을 맞춘 정정은 안전 기준 완화가 아닙니다.

## 새 P1과 기존 이슈 종료

**V11-P1-01 — lifecycle 선언 변경 우회.** 동일한 합성 trusted subject에서 전환 승인false일 때 test_fixture는 보류·후보0이었습니다. artifact.lifecycle만 product로 바꾸면 accept·후보1이 됩니다. trusted subject/context에 원래/current lifecycle이 없고 guard가 현재 manifest의 lifecycle만 보므로, 상태 선언으로 차단 조건을 우회합니다. I05를 재개합니다.

**V11-P1-02 — EXISTING 필수 자격 누락 통과.** available·역할 일치 SupplyLine의 qualification={} 또는 rights 삭제 입력은 accept·후보1이 됩니다. Object.keys가 있는 필드만 검사하므로 필수7개 중 빠진 것을 unknown으로 판정하지 않습니다. empty/all_missing은 같은 실패의 반복 대조입니다.4개의 FAIL을4개의 독립 결함으로 세지 않습니다. I06을 재개합니다.

P1 I01/I02/I03/I07은 순수 상태·주체 결속 범위에서 종료했습니다. I05/I06은 재개합니다. P2 I04/I08/I09/I10/I11의 이번 반례는 종료했습니다. I07의 실제 원장 검증과 전체 신뢰 reader는 **BLOCKED_NOT_IMPLEMENTED**이며 결속 검사의 PASS와 구분합니다. [신규 결함](data/findings.json)·[합성 입력](data/new-counterexample-fixtures.json)·[실제 진단 출력](data/adversarial.json)에 근거가 있습니다.

## 실제 신뢰 문맥의 구현 경계

JSON으로 직렬화한 context, boolean, 브랜드 문자열은 차단됐습니다. 하지만 exported trustedQualificationContext는 symbol을 붙이는 생성자이며 auth·actor 권한·실제 승인/철회·원문/Gold/current revision/실행 기록을 조회하지 않습니다. 이를 실제 승인 검증기로 주장하지 않습니다. 제품 reader와 호출부는0입니다. 브랜드 양성 대조는 명시적 합성 preverified-server 입력입니다.

rights unknown·철회·출처 unverified·D fail은 trusted 대조에서도 보류·부적격이었습니다. G는 check_at_delivery, learnerSuppliableCount는null입니다. 납품 원장을 읽지 않으면 deliveredCount=null, deliveryFulfillment=unknown입니다. 후보1과 납품0을 분리한 대조도 통과했습니다. 실제 교육 상품 승인0입니다. MOCK 조합은 후보0이지만, REAL을 가정한 lifecycle 변이에서 P1이 남아 테스트 교재 전환의 전체 안전성을 PASS로 판정하지 않습니다.

canonicalDemand v2의 중첩 순서 안정성, support/PLAN 변경, v1 본문과의 분리를 검사했습니다. pending B의v2 검사와 pending C의 source_analysis D 필수 변경은 파일 수준 확인입니다. 사용자 제공 미적용 상태를 기준으로 하며 DB 현재 상태를 질의하거나 데이터 이전·마이그레이션 적용을 실행하지 않았습니다. 실제 v1 저장 데이터0을 독립 실측으로 확정한 것은 아닙니다.

## 종료에 필요한 최소 조치

[인수인계](FINAL-HANDOFF.md)의 두 P1을 최소 수정한 뒤 같은 범위에서 재검증해야 합니다. 새 생산 API·공장 내부·교재 콘텐츠·7실행기 개발을 추가하지 않습니다. Gate B의 R5 전용 브라우저 증거도 명확히 결속해야 합니다. Gate C는 그후에도 NOT_CONNECTED입니다.

문서·스크립트·독립 원장만 작성했습니다. 제품 코드·DB/RPC/RLS/UI·공장·교재 변경0, main 병합0입니다. 이번 검토 산출물 완료와 연계 계약 최종 승인을 분리합니다.
