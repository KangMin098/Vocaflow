<!-- docs/research/final-independent-20261018/SERVER_REPAIR_REVERIFY.md -->
# 서버·페이지 수정 독립 재검증

고정 통합 수정 `7e638e63d28791dcc4f886431c0205743dc3310a`의 실제 `server.ts`·학습 페이지 RSC·공급/현재성/결속 SQL을 재검증했다. [실행기](../../../apps/web/scripts/final-independent/probe-authored-server7e.mjs)와 [원본 관찰](./authored-owner7e-server.log). FI-007은 이 서버 경로에서 수정 확인, FI-010은 PARTIAL_FIX / OPEN이다. 전체 A~H는 REWORK다.

## 범위와 격리

커밋의 소스를 임시 snapshot에 추출했고 기존 PGlite 합성 원장 fixture와 실제 서버 함수로 검사했다. 실제 페이지의 로그인 조회·shell·rail·클라이언트 Runner 모듈 경계만 시험용으로 대체했다. 페이지는 실제 React element를 반환하며 Runner에 전달된 본문과 sessionId를 관찰했다. 화면을 본 실제 학습자나 브라우저 전체 E2E라는 뜻은 아니다.

`learning_session_apply` transport는 성공 시 open 행을 저장하거나 실패 응답을 돌려주는 명시적 합성 fixture다. G2 쓰기는 기존 시험 어댑터이며 실제 결속 SQL이 first_exposure/evidence를 판정한다. 실제 learning_session_apply 전체 RPC와 G2 writer의 추가 수용을 주장하지 않는다. 사람 권리/Gold 행도 합성 fixture다. 개발 DB·개인정보·기출 원문을 사용하지 않았다.

선택한 새 검사3건이 기대한 관찰과 일치했다. 변경 없는 기존11건은 필터 SKIPPED이며 이 실행의 통과로 계산하지 않는다. 실패 상태 재현을 기대한 검사까지 포함하므로 '3 PASS'를 제품의 모든 반례 해결로 해석하지 않는다.

## FI-007 · 사후 철회와 현재 공급

정상 납품을 열고 정답을 기록한 뒤 합성 권리 결정을 철회했다. 실제 openDelivered는 `revoked`, requestAuthoredSupply는 해당 자료를 현재 delivered에서 제외하고 부족분 주문을 열었다. 목록은 `current:false`와 이전 `evidence:true`를 함께 보존했다. 권리 철회가 역사적 결과를 삭제하지 않으면서 신규 열기/현재 충족을 차단하는 개선을 확인했다. 별도 [SQL 검사](./SQL_REPAIR_REVERIFY.md)의 본인/타인 current RPC 결과와 일치한다.

판정: **FIX_VERIFIED_IN_CANDIDATE**, 확인된 서버 경로에 한정한다. 실제 개발 DB 적용이나 모든 철회 종류·전체 UI의 수용 완료를 뜻하지 않는다.

## FI-010 · 정상 열람 기록과 실패 경로

| 실제 페이지 호출 | 첫 페이지의 본문 | 닫기 전 open 행 | 다시 연 뒤 결속 | 판정 |
|---|---:|---:|---|---|
| 기록 성공 → 닫기 → 기록 성공으로 다시 열기/제출 | 6문장 | 1 | first_exposure=false, evidence=false | 정상 반복 열람 차단 개선 확인 |
| **기록 실패 응답 → 닫기 → 기록 성공으로 다시 열기/제출** | **6문장** | **0** | **first_exposure=true, evidence=true** | 잔여 결함 |

실제 페이지는 recordOpen=false일 때도 AuthoredRunner에 지문을 전달하고 sessionId만 생략한다. 첫 열람이 기록되지 않은 채 다음 페이지에서는 정상 open 세션이 생긴다. 그 세션은 현재 시도의 세션이므로 결속 SQL은 앞서 열람한 이력을 찾지 못해 first_exposure/evidence를 true로 계산한다. 이는 사용자가 지문을 이미 보았다는 관찰과 어긋난다. 처음부터 열람 기록이 없는 종전 반례는 개선됐지만, 필수 반례 '기록 일부 누락 후 미노출 판정'은 남았다.

기대: 본문을 공개한 사실을 보존할 수 없는 경우 이후 기록이 새 독립 첫 수행으로 승격되지 않아야 한다. 공개 전 필수 기록을 확보하거나 불확실성을 남기는 등 구현 선택은 총괄 담당에게 맡긴다. 특정 함수/guard를 새 필수 게이트로 강제하지 않는다. 동일 #302에서 성공 경로 개선과 실패 경로 잔여 반례를 함께 추적한다.

## FI-010 독립 수정 후보 · 제품 미적용

총괄 소스와 겹쳐 쓰지 않도록 [실행기](../../../apps/web/scripts/final-independent/probe-authored-server7e.mjs)의 `--candidate-open`은 무시되는7e 스냅샷의 페이지에만 [최소 후보](./fi010-open-candidate.patch)를 적용했다. 대상 페이지가964와 바이트 동일함도 확인했다. 기록을 남기지 못한 미완료 자료에는 본문 대신 재진입 안내와 학습 지도 링크를 반환한다. 제품 브랜치·인덱스·실제 DB를 바꾸지 않았다.

[실제 RSC/서버/결속 SQL 대조](./authored-open-guard-candidate.log): 바뀐2개 조합만 통과했고 나머지12개는 필터 SKIPPED이며 새 통과로 더하지 않는다.

|후보의 첫 열기|첫 응답의 본문|재열기/제출 뒤 결속|해석|
|---|---:|---|---|
|기록 성공|6문장|first_exposure=false, evidence=false|이미 공개된 본문은 다시 독립 첫 수행이 되지 않음|
|기록 실패 응답|0문장 · 재진입 안내|first_exposure=true, evidence=true|첫 화면에 본문이 없었으므로 뒤의 성공한 열기가 실제 첫 공개임|

기존 반례는 첫 화면에6문장을 공개하고도 같은 true/true를 만들었다. 후보는 최초 공개 자체를 보존 가능한 시점까지 미뤄 그 불일치를 제거한다. true를 언제나 false로 바꾸어 정상 독립 수행도 잃는 후보가 아니다. 화면 안내 문구와 비공개 상태도 RSC 반환으로 확인했다.

세션 RPC transport와 G2 writer는 앞선 검사와 같은 명시적 합성 경계다. 실제 Supabase의 저장 후 응답 유실, 이미 완료된 자료 재방문, 전체 브라우저/디자인·접근성은 이 후보의 수용 범위 밖이다. 처음 검사기에서 React 객체 전체를 JSON으로 검사하다 순환 참조 오류가 났고, 텍스트 자식만 순회하도록 검사기를 고친 최종 결과를 위에 보존했다. 제품 결함으로 등록하지 않았다.

이는 채택 가능한 독립 후보의 확인이며 총괄 제품 수정/최신 CI/실제 공급 완료가 아니다. FI-010 전체 상태는 기존 #302에서 PARTIAL_FIX / OPEN으로 유지한다.

## 통합 상태

SQL 검토는 [별도 원장](./SQL_REPAIR_REVERIFY.md)에서 FI-002/003/004 후보 수정과 FI-006 잔여 경합을 구별한다. FI-008/011/012/013/005/014의 UI·환류·채점·내용 후속 검증은 계속한다. PR303 최신 결과는 [후속 원장](./PR303_4A_REVERIFY.md)의71a 수정/최신 CI에서 확인한다. shared-dev SKIPPED는 실제 DB 통과가 아니다. safe-merge/병합/실제 DB 적용/사람 승인은 수행하지 않았다.
