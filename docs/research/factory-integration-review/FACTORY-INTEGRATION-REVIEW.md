# Factory Integration Contract — PR264 독립 검토

2026-10-15. **전체 계약 수용은 FAIL이며 실제 공장 연결·제품 자격 승인은 HOLD다.** 독립 검토 산출물과 진단 실행은 완료했다. 원본19개 테스트는19개 통과했지만 신규82개 기대조건 중40개가 실패했다. 진단용 Vitest82개가 모두 통과했다는 것은 봉인된 실패 출력까지 재현했다는 뜻으로, 수용 PASS가 아니다.

검토 PR HEAD: 8b4289f8196be3c7e81ab6393f60eee46d243e88. 시작에 GitHub로 재확인한 상태는 **MERGED**였다. 최신 main은70776bb0c5230a04fdac96068fa7c326efc62cd9였고 필수 파일/의존/호출부15개는 PR blob과 main blob이 같았다. 별도 review/factory-integration-contract-v1 worktree에서 원본 파일을 변경하지 않았다. [revision 원장](data/revision.json)은 정확한 hash와 private snapshot을 결속한다.

## 결과

| 검증 | 판정 | 이유 |
|---|---|---|
| A manifest 상태/구조 | FAIL | 21개 중17 실패. spec_created/order_received/failed/review_failed/review_pending/unsupported 등과 accept가 충돌해도 후보1 |
| B 테스트성 산출물 경계 | FAIL / 실제승인 HOLD | MOCK과 test_fixture 차단은 통과. REAL/EXISTING+product+합성pass/boolean으로 후보1; 서버 근거 검증 경계 부재 |
| C 기존 R5 자산 | FAIL / 실제자산 HOLD | available SupplyLine만으로 released/cleared/passed/accept를 생성. 10개의 누락 조건명을 실행했으나 실제 DB의10개 불량 자산을 발견한 것은 아님 |
| D FQ A–H 근거 결속 | FAIL | ID/revision/TASK/role 기본 결속은 통과. artifact/source/analysis/Gold 변경과 신뢰 안 된 승인 boolean은 수용 |
| E 외부 요청 호환성 | FAIL | requestBody JSON.parse 실패, nested requires 순서가 key 변경. 같은 본문 재사용·다른 사용자/PLAN 분리·동일key다른body 거절은 통과 |
| F 생산 단위 표현 | 제한 PASS | 6개 표현 검사 통과. convertible_to_volume은 활동 생산 가능·실제접수·API승인이 아님 |
| G Workspace 수량/결속 | FAIL | ID만 쓰는 verdict의 revision 상속, 평가 역할 candidate/fulfillment 충돌. 부분 후보 계산·미지원 runner 차단·learnerGate 표시는 통과 |
| H 교육 목표 보존 | 부분 PASS / FAIL | 재고0 수요·계획량·역할 구별은 유지. source_analysis에서 D fail을 허용하는 FQ11 불일치1개 |

**11개 결함 그룹: P1 6개·P2 5개·P3 확정0개.** [상세 결함](FACTORY-INTEGRATION-FINDINGS.md)과 [시험 행렬](FACTORY-INTEGRATION-TEST-MATRIX.md)에 입력·기대·실제 결과·수정 제안을 결속했다. 40개의 실패는11개의 독립 issue 그룹이며 모든 실패를40개의 독립 제품 결함으로 계산하지 않는다.

## 해석과 영향 범위

새 함수를 호출하는 실제 제품 코드는 검색에서 발견되지 않았고 original test에서만 사용된다. 따라서 지금 학습자에게 잘못된 교재가 공급됐다는 운영 사고·악용을 입증한 것은 아니다. 그러나 이 계약을 REAL 연결에 그대로 재사용하면 미래 공급 승인의 안전장치가 부족하므로 mock이라는 이유로 수용 PASS를 주지 않는다. 기존 제품의 reveal/held/사용자별 기록 reader는 확인했고 원본은 보존했다. 실제 유효한 R5 승인 자산을 DB/브라우저에서 검증한 수는0이다.

합성 FQ pass/approval true/lifecycle product는 시험 입력이다. 원문·Gold·학생응답·실제승인 기록을 새로 만들지 않았다. C의 condition명(미출시/다른TASK/이미본문항/존재하지않음/공유지문/전체회차)은 현재 wrapper에 해당 서버 사실을 확인하는 입력·reader가 없다는 동일 신뢰 경계의 여러 요구 사례다. 조건별 실제 DB 검증과 순수 wrapper 재현을 혼동하지 않는다. D의 철회/다른자격 승인 필터와 공급시점 exposure 차단은 통과하지만 context의 진정성은 별도다.

FQ11-HANDOFF/ROLE-GATES와 FQR1-HANDOFF/RUNNER-CONTRACT를 읽고 snapshot hash를 보존했다. 타입 검색과 TASK 수행, 공통자격과 학생노출, 모델링과 독립평가, 연구후보와 공개제품을 분리하는 교육 방향은 유지한다. 학생 효과·숙달률·점수상승을 추정하지 않았다. 승인 booleans나 임의64자 해시로 권리·교육적 효과를 보증하지 않는다.

## 수정과 미확정 범위

[Claude 인수인계](FACTORY-INTEGRATION-HANDOFF.md)는 최소 코드 수정과 서버의 Trusted Qualification Context를 제안한다. manifest 상태와failure 검사, immutable verdict binding, 표준JSON/canonicalizer, 기존자산/승인 reader 결속, 후보·납품 충족도 구별이 우선이다. 공장 내부·생산 API·7실행기·신규RPC를 다시 구현할 필요는 없다.

실제 공장 API·활동 생산 단위·manifest export는 별도 공장 개발이다. DB/RLS/migration 적용·실제 권리/출시·test_fixture 전환 승인·학생별 공급 권한과 노출은 별도 검증이다. 현재 테스트 교재를 교육 상품으로 승격한 수0, 실제 공장 호출0, 실제delivery0, 학생수행/효과0, 제품파일변경0, main병합0이다.

## 실행 기록

원본19/19 통과와 신규 진단82/82 실행 통과를 별도로 보존했다. 신규 안전 기대조건은42 PASS/40 FAIL이다. --acceptance는FAIL을 exit1로 보고한다. 제안 Schema/JSON 예시는 외부 shape 검토용이며 실제 consumer/API로 검증한 호환성 증거가 아니다. 반복 실행은 최초 counterexamples 원장을 덮지 않고 exact result 비교한다. 제품 코드15개와 연구문서4개의 snapshot, 추가rank/study source, public artifact hashes와 링크를 연구 검사기로 검증한다.

검토 중 HEAD가 바뀌면 r1을 보존하고 r2로 재감사해야 한다. 이번 검토가 이후 코드 revision에 자동 상속되지 않는다.
