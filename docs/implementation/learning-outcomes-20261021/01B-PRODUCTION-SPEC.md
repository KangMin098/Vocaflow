<!-- docs/implementation/learning-outcomes-20261021/01B-PRODUCTION-SPEC.md -->
# 단계 1B — 실제 소량 제작과 판본에 결속된 결과 manifest

기준 `1c17a0a01` · 주 목표 VG-L3-C1-01 · 위험 L3 · 구현 Claude Code 새 세션, 독립 내용/반례 검수 Codex.

## 목적

1A의 실제 공장 주문 초안에서 작업 패킷을 내보내고, 실행 중인 Claude가 문항·해설을 직접 작성한 결과를 검증해 HTML·자료 JSON·manifest·실행 영수증을 만든다. 교재공장을 다시 만들지 않고 기존 canonical JSON·주문 sealer·원천 evaluateSource·FactoryResultManifest 검사를 재사용한다. API 키를 기다리지 않는다.

이번 제작물은 **내부 검수 후보**다. 실제 원천과 실제 작성 결과가 있지만 등록·발행·납품은 하지 않는다. 합성 주문/수요를 쓴 smoke는 명시적으로 표시한다. 기존 synthetic 전권 조립 함수를 실제 제품 생산 증거로 바꾸거나 synthetic_fixture 라벨을 제거하지 않는다.

## 입력과 재사용

- 입력 1: 1A `draft_prepared` 응답(수요 참조/spec/order/order_hash/planning_hash). 기존 실제 `sealProductOrder`로 order hash를 다시 계산한다. 임의 `registrable=true`·승인 flag·대응 validated 입력으로 권한을 만들지 않는다.
- 입력 2: 원천 snapshot. Codex가 개발 DB에서 SELECT만으로 확보한 `D:/workspace/Vocaflow-AI-Control/runtime/learning-outcomes-20261021/source-snapshot.json`. `source=original`, 제목 What a Name Does to a Picture. 본문·상태·gate·분석·라이선스는 DB 관측값이다. 이는 새 권리/발행 승인이 아니다.
- 원천 적격성은 `sourceEligibilityInput` + `evaluateSource(...,'textbook')`를 실제 호출한다. blocked/review/conditional을 eligible로 바꾸지 않는다. 상태·본문·권리 metadata에 결속된 digest를 저장한다. 원문의 literal backslash-n이 있으면 원본 hash를 유지하고 표시용 정규화 hash/변경 내역을 별도로 기록한다.
- 현재 대응 중 `r.central_meaning`→공장 R4/P07의 `guided_practice` 한 역할로 범위를 제한한다. 독립 확인·전이·지연 문제를 이 생산물에서 승격하지 않는다.
- source snapshot은 이번 읽기 시점의 입력이다. import 시점 실DB 재조회가 없으면 그 사실을 기록하고 발행/현재 적격성 승인을 만들지 않는다.

## 파일과 실행

1. `apps/web/src/lib/csat/map/v62/factory-bridge/local-production.ts`: 순수 패킷 생성·출력 검증·manifest 생성. 시각/run ID는 인자로 받는다. 기존 package schema를 쓰고 web에 직접 zod 의존을 추가하지 않는다.
2. `scripts/textbook/factory-production-local.mts`: 기존 tsx 실행 방식의 CLI. export/import 두 단계. `--prepared`, `--source`, `--request`, `--output`, `--out` 등 역할별 명확한 입력과 새 외부 경로. 공유 DB/네트워크 쓰기·패키지 설치 없음. core 로직은 위 함수에 둔다.
3. 해당 core 인접 `__tests__/local-production.test.ts`: 실제 sealer/evaluateSource/validateManifest를 mock하지 않는 시험. 파일 side effect는 CLI 경계로 분리한다.
4. `01B-PRODUCTION-RESULT.md`, 필요 계약 문서 1곳. 새 공통 framework, 공정 종류, 새 화면은 만들지 않는다.

`export`: 원천·주문·수요·역할·수량을 검증해 `chunk-01.json`과 구체적인 작성 지시를 만든다. 패킷 hash는 실행 시각 같은 비의미 필드와 분리한다. 원천/주문/요구가 같으면 같은 작업 식별자다. 권리 불명·오래된 자료는 이유를 보여주며 적격이라고 쓰지 않는다.

에이전트가 `chunk-01.out.json`을 **직접 채운다**. 요청 수량만큼 서로 다른 문항(허용 type·발문·선지·정답·해설·지문에 실제 있는 근거 quote)을 작성한다. 빈 값·추측 채움·문항 대신 placeholder는 금지한다. 해설은 관찰 근거와 해석을 구분한다.

`import`: 원본 패킷과 출력의 request/order revision·hash/source digest·TASK/role/수량·문항 id/type·선지/정답 참조·근거 quote를 재검증한다. 하나라도 틀리면 파일을 만들기 전에 거절한다. HTML에는 원문과 문제를 escape해서 넣고 답/해설은 별도 자료 JSON에 보존한다(공개 학습 화면 아님). HTML·JSON을 실제 쓴 bytes로 hash한다. 파일은 wx로 새 경로에만 만들고 충돌/부분 실패는 명시적으로 처리한다.

기존 FactoryResultManifest와 비교 가능한 결과는 `review_pending`, 공개 적합성 미주장으로 만든다. 실제 로컬 실행 영수증이 있을 때만 REAL run을 기록한다. 검증용 실행/합성 수요의 lifecycle은 test_fixture로 보존한다. artifact는 textbook_activity 또는 기존 계약이 실제 지원하는 종류만, 생산량은 실제 작성·검증된 수량만 쓴다. 실행 영수증은 DB 실행 원장 인증을 대체하지 않는다. 원천/권리·검수·공급 자격은 별개이며 registrable/production-ready/released/delivered를 만들지 않는다.

## 수용 기준

| AC | 실제 시험/산출 |
|---|---|
| B1 | 1A 응답→export→Claude 실제 작성→import→HTML/JSON/manifest/receipt 생성까지 한 소량 실행을 실제 완료 |
| B2 | 정상 + order/source/request hash·revision·role/TASK/수량 변조, 중복 id, 답 없는 선지, 없는 근거 quote 거절 |
| B3 | 원천의 폐기/권리 제한/분석 미비/내용 미판정/난도 부적합은 evaluateSource 결과 그대로 거절 |
| B4 | 원문·선지의 HTML 주입이 실행 코드로 조판되지 않음. 실제 산출 파일 hash와 manifest 일치 |
| B5 | 입력이 같은 재실행은 같은 작업 id, 출력 충돌은 조용히 덮지 않음. 입력/패킷 판본이 달라지면 과거 출력 재사용 거절 |
| B6 | 웹 타입·변경 파일 lint·새 core와 기존 factory-bridge 회귀 통과. 실행/skip/미실행을 구분 |

작업 자체와 시험 로그, 후보 자료는 외부 runtime의 이 작업 전용 하위 폴더에 보관한다. source·콘텐츠·출력에 user UUID/이메일/세션 Cookie를 넣지 않는다. source id/content hash는 계보이므로 유지한다.

## 다음 경계

1C에서 현재 원천·정책·AI 검수·등록부와 기존 공급 RPC를 연결한다. 1D에서 실제 수행/전이와 PLAN 복귀를 검증한다. 1B 통과를 이를 대신해 보고하지 않는다. 사람 검수나 학생 모집은 선행조건이 아니며 [AI 역할 계약](./AI-VALIDATION-ROLES.md)을 적용한다.

## Codex 보완 R2 — 부분 쓰기 실패 복구

실제 CLI 제작은 Codex가 실행해 3문항과 4개 파일 생성을 확인했다. 그러나 `probe-write-rollback.mjs before`가 sheet.html에 1바이트를 쓴 뒤 오류를 주입하자 output 디렉터리와 sheet.html이 남았다. 원인은 `writeFileSync` 성공 뒤에만 created 목록에 넣는 순서다. 1A CLI 기본 writer도 같은 형태로 실패한 신규 파일을 정리하지 않는다.

두 CLI의 새 파일 writer를 보완한다. `openSync(path,'wx')` 성공으로 파일 소유를 확정한 뒤 fd로 쓰고, 실패하면 닫고 **그 실행이 연 파일만** 제거한다. 기존 파일의 EEXIST에서는 삭제하지 않는다. 1B의 여러 파일 rollback은 앞서 완성한 자기 파일도 정리하고 마지막 디렉터리는 재귀 삭제 없이 제거한다. 정리를 못 했다면 성공/복구 완료로 말하지 않는다. 작은 helper를 기존 파일에서 공유해도 되며 새 framework/파일은 만들지 않는다.

실패 주입을 실제로 수행하는 Node 시험에서 첫 파일과 후속 파일 부분 쓰기, close/cleanup 오류, 기존 파일 보존·fd 정리를 확인한다. 기존 node CLI9·호출부5 및 core17을 유지한다. Codex 외부 probe의 before는 실패 근거로 보존하고 수정 뒤 새 경로 `after`를 실행해 output 디렉터리·파일이 남지 않음을 확인한다. 공유 DB 작업 없음.
