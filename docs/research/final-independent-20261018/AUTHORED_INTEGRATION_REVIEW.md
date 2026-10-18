<!-- docs/research/final-independent-20261018/AUTHORED_INTEGRATION_REVIEW.md -->
# 창작 공급 → 수행 → 환류 독립 검토

2026-10-18 · 고정 대상 `52a31d988`(총괄 worktree 커밋, 통합 PR 미제출). **REWORK**. 전체 제품 완료 판정이 아니다. 실제 개발 DB 쓰기와 사람 승인은 수행하지 않았다.

## 수행한 검증과 한계

- 고정 커밋을 독립 worktree의 무시된 임시 디렉터리에 추출했다. `.env*`는 복사하지 않았고 실제 DB 쓰기 차단 preload를 적용했다. 총괄 개발 파일은 변경하지 않았다.
- 작성자의 PGlite 종단 10건은 그대로 통과했다. 실제 서버 함수 `requestAuthoredSupply/openDelivered/recordAuthoredAttempt/listDelivered`와 보류 SQL을 사용한다. PGlite·최소 Supabase 어댑터이므로 실제 RLS·동시성·브라우저·공유 DB 성공을 뜻하지 않는다.
- [철회 반례 실행기](../../../apps/web/scripts/final-independent/probe-authored-currentness.mjs)를 추가해 같은 서버/SQL로 사후 철회를 관찰했다. [원본 출력](./authored-currentness.log)의 11건 통과는 기존 10건과 **결함 관찰 단언** 1건이며, 제품 수용 PASS가 아니다.
- [브라우저 실행기](../../../apps/web/scripts/final-independent/probe-authored-browser.mjs)는 실제 `AuthoredRunner`·`AuthoredSupplyCard`·CSS를 Chromium 1280/1440에서 실행했다. 합성 지문·API 응답·로컬 Link 래퍼를 사용했다. [원본 결과](./authored-browser/results.json) 21개 관찰에서 런타임 오류·외부 요청·가로 넘침은 없었다. 키보드 중심 문장 선택, 불완전 답의 제출 차단, 오류 재시도, 목표 계획 미확정/공급 미설치/빈 공급, 결과 복귀 href를 확인했다. 실제 CsatShell·인증 라우트·팝업·학습지도 복구·실제 DB의 종단 E2E는 아직 미검증이다. 참조 디자인 일치 판정도 하지 않는다.
- [1280 풀이](./authored-browser/1280-independent.png)·[1440 결과](./authored-browser/1440-result.png)는 위 격리 컴포넌트 범위의 화면이다. 실제 제품 전체 화면 캡처로 표시하지 않는다.
- [재시도 실행기](../../../apps/web/scripts/final-independent/probe-authored-retry.mjs)는 브라우저의 실제 요청 메타데이터를 기존 읽기 전용으로 수집한 G2 함수 본문에 재생했다. [결과](./authored-retry.json)에 입력 계약과 함수별 SHA를 보존했다. 최소 스키마의 PGlite이며 운영 trigger/RLS/동시성 시험은 아니다.

## FI-007 · 핵심 P2 · OPEN · 철회된 기존 납품을 현재 공급으로 재사용

1. 합성 승인된 `authored:r5-cm-ind-1/2`를 사용자 A의 같은 CHECK 수요(2개)에 납품한다. ind-1 수행을 정상 결속한 뒤 ind-1의 권리 사람 결정에 철회를 기록한다(격리 DB만).
2. DB `supply_delivery_valid(ind-1 delivery)`는 **false**다. 과거 `workspace_delivery_attempt.evidence=true`는 그대로 보존된다. 과거 원장을 삭제하지 않는 것은 정상이다.
3. 그러나 `openDelivered`는 **ok**를 반환하며 본문을 계속 제공한다. 같은 `requestAuthoredSupply`는 두 기존 ref를 모두 delivered로 계산하고 **orderOpened=false**를 반환한다. `listDelivered`는 현재 무효 상태 구분 없이 `evidence=true`를 반환한다.
4. 원인: 열기/목록은 납품 이력 존재만 확인하고 현재 유효성을 검사하지 않는다. 공급 요청은 `have`의 모든 기존 artifact_ref를 수요 충족량에 더해 현재 무효 1건을 부족분으로 재계산하지 않는다. SQL이 새 납품을 차단해도 이 서버 경로가 우회된다.

기대: 철회 이력과 과거 수행은 보존하되 신규 본문 제공과 현재 공급 충족 계산은 현재 자격/승인/권리 유효성에 따라야 한다. 현재 무효 자료는 검수 대기/철회 상태와 다음 행동을 표시하고, 유효 납품이 모자라면 실제 부족분을 보충/주문한다. 과거 근거와 현재 자격의 의미를 구별한다. 과거 정상 수행을 일괄 삭제하라는 요구는 아니다.

지도 `gateAuthoredFirsts/applyAuthoredBindings`도 과거 결속의 evidence/hash만 사용한다. **현재 자격과 과거 측정의 정책을 확인할 항목**이며 이 관찰만으로 과거 능력 근거를 모두 취소해야 한다고 단정하지 않는다. FI-007의 확정 반례는 계속 열람과 현재 수요의 허위 충족이다.

## FI-008 · 핵심 P2 · OPEN · 같은 답 재시도의 응답 시각 변경

1. 실제 Runner에서 답을 고르고 제출한다. 첫 요청이 저장된 뒤 응답이 유실되어 같은 답을 재시도하는 조건이다. 브라우저 시험에서는 오류 응답으로 재시도 버튼 경로를 열고 두 요청을 수집했다.
2. 화면은 `clientMutationId`를 유지하지만 `answeredAt`은 submit마다 새 `Date`로 만든다. 1280에서 08:20:26.874Z → .936Z, 1440에서 08:20:27.823Z → .889Z로 달라졌다. 답·세션·제출 ID는 같다.
3. 수집한 첫 요청을 G2 원자 함수에 재생하면 **inserted**, 완전히 같은 재전송은 **duplicate**, 실제 브라우저 재시도처럼 시각만 바꾼 요청은 두 폭 모두 **conflict**다. `learning_attempt_record`의 원문 비교에 answered_at이 포함되는 정상 무결성 계약과 화면의 재시도 계약이 어긋난다.
4. `recordAuthoredAttempt`는 conflict를 입력 오류로 반환하므로 화면의 「같은 답으로 다시 누르면 한 번만 저장」 복구가 성립하지 않는다. 첫 저장 이력은 남지만 결과/해설을 재수신하려던 학습자는 충돌 오류를 보게 된다.

기대: 같은 논리 제출의 재시도는 ID뿐 아니라 판단 시각과 의미 입력 전체를 보존해야 한다. 답이 바뀌었을 때 새 제출을 만든다. SQL의 본문 불일치 거절을 약화하지 않는다. 수정 뒤 실제 서버 저장 성공/응답 유실/동일 재전송/본문 변경 거절을 검증한다. 작성자 종단 fixture의 writer는 response만 비교해 이 시각 차이를 놓치므로 이 반례는 실제 원자 함수 계약과 연결해 유지한다.

## 추가 UX 관찰(별도 필수 게이트로 확대하지 않음)

- 빈 재고에서 API가 `orderOpened=false`를 반환해도 공급 카드는 「제작을 요청해 두었어요」라고 말한다. [1280 화면](./authored-browser/1280-shortage.png)·[결과 JSON](./authored-browser/results.json). 실제 주문 결과/오류와 일치하는 안내가 필요하다.
- 자료 링크와 결과 복귀 링크는 납품/Workspace/PLAN 정체성을 전달하지 않는다. 이는 기존 **FI-001**의 동일 원인이 새 경로에 이어진 관찰이며 새 ID로 중복 제출하지 않는다.
- 지연 역할의 「며칠 지난 뒤」 안내와 창작 자료의 출처 표시, 기존 페이지 title의 「기출」 표기는 실제 전체 라우트 검증에서 확인할 예정이다. 현재 컴포넌트 캡처만으로 사실상 기출 가장이나 지연 효과 완료를 판정하지 않는다.

수정 소유권: Claude-VOCAFLOW-FINAL-OWNER가 현재 같은 제품 인터페이스를 구현 중이므로 독립 세션은 재현기/보고서만 변경했다. 새 공개 게시 승인이 도착하기 전까지 FI-002 이후 자료는 로컬 공유 원장에서 전달한다. 실제 SQL 적용, 사람 Gold/권리 승인, 출시 허가는 별도 조건으로 남는다.
