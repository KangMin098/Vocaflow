# 독립 반례와 최소 보완

초기 bridge 소스는 제출 200bfdeac와 동일(통합 9e6393e42). 기존 28/28 PASS였지만 추가 45개 중 40개 FAIL, 5개 PASS였다. [INITIAL.json](./INITIAL.json)을 보존한다. 결함 수와 반례 수는 다르다. 첫 보완 회차는 73/73 PASS이며 최종 HEAD/회귀/CI는 종료 보고에서 확정한다.

| ID | 심각도 | 최초 재현 | 최소 보완/재검증 |
|---|---|---|---|
| I01 | 잠재 P1 | 정책 hash/revision·수량·환산 근거·요청 유형이 달라도 같은 shareKey. 같은 요청 중복 membership | production-share/2 정규 명세에 결속, 요청 ID 집합. 개인 버전 제외는 보존 |
| I02 | 잠재 P1 | run.recorded+artifacts로 누락 브리프/정책/대응 검증을 우회. 존재만 하는 malformed brief도 READY 가능 | run 자기보고로 상태 승격 금지. 실제 factory planner/order 검증기 미연결은 NEEDS_ORDER_VALIDATION. READY/run 상태는 예약만 |
| I03 | 핵심 P2 | 음수/NaN/Infinity/비정수/범위 밖 수량을 clamp/floor, 무한 factor로 생산 0 | 안전한 비음수 정수만 허용, 유한 factor/근거·상충/overflow 검사 |
| I04 | 핵심 P2 | 동일 artifact가 여러 번 적격으로 집계. 상충 revision/승인도 순서에 따라 선택 | 동일 후보 한 번, 상충 후보 전체 보류. 서로 다른 연습 문항과 평가 공유 지문은 구별 |
| I05 | 핵심 P2 | 다른 TASK/역할/계획량 stock을 생산 요청에 붙임 | 요청과 stock의 task/role/quantity·부족량/중복 적격 ID 일치 검사 |
| I06 | 핵심 P2 | invalid manifest hash·중복 artifact ID·음수 revision/day·빈 계보를 구조 검증 통과 | 참조/정체성/형식 차단. STRUCTURAL_ONLY·contentVerified=false를 반환. supplyApproved=false 유지 |
| I07 | 핵심 P2 | E2 근거 위치를 E1로 기재, E3 선지 대응에 어법 전용 P06 검색 후보 | E2/E1 정본 수정, 잘못된 E3-P06 후보 제거, 나머지 전부 candidate/search_only 유지 |

P0 재현 없음. 전부 순수·미연결 계약의 결함이며 실제 주문/공급 사고가 발생했다고 주장하지 않는다. I1 미적용 SQL의 NULL 검수 우회 P1 등은 [SQL-AUDIT](./SQL-AUDIT.md)의 BLOCKED_APPROVAL로 별도 보존한다. 해당 SQL은 사용자 금지 범위이므로 변경하지 않았다.

## 기존 테스트 변경의 정당성
S01–S16 전체 본문/기대는 제출본과 바이트 동일: sha256 e22ecdac03b5b85b99e43b55773305e1bfb469299a4d5eea4f2d8dcf97149c19. 28개 중 그 밖의 run 승격 테스트 1개는 확인된 우회 결함을 거절하도록 강화했고, 정상 lineage 기대 1개에는 내용 검증을 주장하지 않는 범위 필드 두 개를 추가했다. 두 변경은 느슨한 PASS를 만들기 위한 것이 아니다. 최초 관찰은 덮지 않았다.

## 후속 목적 검토
[PURPOSE-REVIEW.json](./PURPOSE-REVIEW.json)은 c98cb6210에서 추가 3건을 재현한 원장이다. 수정 후 동일 48개 독립 검사와 기존 28개, 총 76개가 통과했다.

| ID | 심각도 | 반례 | 보완 |
|---|---|---|---|
| I08 | P2 | 승인 배열 순서만 달라도 같은 재고를 상충 처리 | 승인 레코드를 순서 무관하게 정규화 |
| I09 | P2 | evidenceId가 같고 올림 수량도 같으면 factor 2/3의 차이가 키에서 사라짐 | projection에 factor를 보존해 shareKey에도 결속 |
| I10 | P2 | guided_practice 전용 대응이 source_analysis 생산 후보로 유입 | materialRole을 필터하고 역할 미지원 blocker/빈 후보를 반환 |

I08/I09는 첫 보완의 부족을 드러낸 반례다. 첫 결과를 수정하거나 최종 PASS로 바꾸지 않았다.

I11(P2, 검증기 재현성): sql-isolated.mjs가 새 체크아웃에서 local 디렉터리를 만들지 않아 결과 저장 시 ENOENT였다. 원본 제출 worktree에 해당 실행기만 놓은 빈 출력 환경에서 exit 1을 실제 확인했고, mkdir 보완 후 같은 환경에서 exit 0/제안 검증 7개를 확인했다. 이 임시 실행기·출력은 정리하고 원본 worktree는 깨끗하게 유지했다.
