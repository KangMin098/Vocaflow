<!-- docs/implementation/learning-outcomes-20261021/01D-LEARNER-SPEC.md -->
# 1D — 받은 공장 교재를 열고 수행 기록으로 돌아오기

기준 `c78bf9bbd` · 주 목표 VG-L3-B2-02 · L3 · PC 웹. 1C의 등록 후보를 실제 승인·납품한 경우에만 학습자가 이용한다. 공유 DB의 새 SQL은 아직 미적용이며 이번에도 격리 환경만 쓴다.

## 사용자 흐름과 범위

현재 Workspace → 받은 공장 연습 자료 → 원문/문항 열기 → 선택 응답 → 서버 채점/저장 → 결과와 다음 행동 → 같은 Workspace. 중심 의미 `r.central_meaning`의 `guided_practice` 3유형(topic/title/main_point)만 지원한다. 이 풀이는 연습 기록이며 R5 독립 확인이나 학습 향상 근거가 아니다. 재평가·계획의 최종 연결은 단계 2의 미노출 독립 자료와 함께 완성한다.

관리자가 제품주문을 개인 주문에 잇는 D3 권한을 학습자 API가 흉내내지 않는다. 관리자 연결은 기존 product-order-lineage 경계/1C의 별도 관리자 세션으로 수행하며, 여기서는 이미 존재하는 명시적 납품을 연다. admitted_by를 현재 요청의 가짜 관리자 actor로 쓰지 않는다.

## 재사용과 구현

1. 서버 `factory-bridge/dcp-learning.ts`: 명시적 deliveryId로 본인/Workspace/현재 유효 납품/등록 후보/role·TASK·제품 계보/현재 원문과 문항 판본을 확인한다. 목록·열기·제출 DTO를 분리한다. 답변 전 payload의 passage/choices/stem만 내보내고 answer_key/해설/검수 Gold는 보내지 않는다. 미설치/조회 실패/없음/철회를 구분한다. source id가 같은 3문항을 독립 지문 3개라고 세지 않는다.
2. 실제 학습자 화면 `/csat/factory/[deliveryId]`: 기존 인증·3B 스킨·`DcpPlayer`/`DcpItems`를 재사용한다. 새 Runner는 기본 grade 대신 납품에 결속한 서버 제출을 사용한다. 같은 제출 재시도는 같은 mutation/session id를 유지하며 저장 실패를 오답으로 표시하지 않는다. 새 제출 키는 새로운 학습자 응답에만 쓴다. 보이는 focus·44px·break-keep를 지킨다.
3. API는 최소 GET 목록(Workspace 소유 확인)과 POST `/api/csat/factory/[deliveryId]/attempt`. userId/actor/정오/원문 hash/승인 상태를 클라이언트에서 받지 않는다. POST의 출처·JSON·작은 본문·닫힌 필드·현재 세션을 검사한다. 서버 시각은 경계에서 주입하거나 실제 SQL 수신 시각을 쓴다.
4. 현재 Workspace의 실제 진입점을 붙인다. `AuthoredSupplyCard`의 창작 경로를 덮지 말고 공장 DCP 목록을 별도 작은 카드로 붙이거나 판별 가능한 종류로 확장한다. 임의 /dev 화면만 만들고 끝내지 않는다. 목록·돌아오기에서 현재 Workspace/PLAN을 유지한다. 비유효 납품은 새 학습 링크를 만들지 않는다.
5. 필요한 최소 `_pending_factory_dcp_learning.sql`을 작성한다. 기존 **실제** `grade_dcp_item(uuid,jsonb)`를 호출해 정오와 `csat_item_attempts` UUID를 얻는다. 기존 G2 세션·시도·`workspace_delivery_attempt`를 가능한 범위에서 재사용하고, 응답/학습 기록/납품 결속은 원자적·멱등이어야 한다. 실제 반환값은 `{correct,attempt_id,answer_key}`이며 실패/빈 값/미상 정오는 false로 바꾸지 않는다. 새 원장은 기존 표로 해결할 수 없는 실제 제약이 있을 때만 추가하고 이유를 문서화한다.
6. 기존 G2는 DCP를 지원하지 않고 annotation_ref/hash가 NOT NULL이다. 이를 가짜 Gold로 채우지 않는다. 필요한 경우 실제 DCP 정답키·grader 판본에 결속한 **연습 채점** 주석을 자격 기록에 명시하고 DCP×guided 분기를 추가한다. E 축/독립 자격으로 승격하지 않는다. 부모 시도·세션·문항·delivery·Workspace·서버 시각·현재 판본·소유·재전송을 검사하고 `evidence=false, non_evidence_reason=role_not_evidence`를 유지한다. 현재 R5/csat/authored 경로를 퇴행시키지 않는다.
7. 결과 후에는 실제 기록에 근거한 연습 완료와 독립 확인 필요/다시 연습 안내를 보여 주고 Workspace로 돌려보낸다. 기존 `nextActionOf`/계획 모델을 재사용한다. 선택 정답만으로 목표 달성·독해 능력 상승을 쓰지 않는다. 단계 2에서 실제 독립 수행이 다음 PLAN 저장까지 이어진다.

DB 실제 확인(읽기만, 2026-10-21): grade_dcp_item 인자는 위 두 개, learning_attempt_record와 learning_session_apply가 존재한다. learning_task_attempts.is_correct는 nullable이고 client_mutation_id/session_id/received_at가 있다. workspace_delivery_attempt는 annotation_ref/hash가 필수다. 문서 목록을 DB 정의 대신 쓰지 않는다.

## 수용

| 기준 | 실제 검증 |
|---|---|
| D1 | 실제 1A/1B core→1C 실제 SQL 등록/검수/승인/링크/납품→목록/열기→서버 채점/시도/결속→복귀를 격리 연결 |
| D2 | 답변 전 정답/해설 없음, 제출 후 정오·피드백·저장 결과 표시. 실패는 오답/완료 아님 |
| D3 | 같은 키 같은 응답 같은 결과, 응답 유실·중간 실패 복구; 다른 응답·다른 delivery 재사용 거절 |
| D4 | 타인·닫힌 Workspace·철회·구 원문/문항·wrong role/task/제품 링크 거절. 연습은 독립 근거 false |
| D5 | 실제 PC 브라우저에서 기존 제품 컴포넌트의 읽기/선택/실패 재시도/제출/복귀를 실행하고 캡처 확인 |
| D6 | 관련 기존 G2/DCP/공급 회귀·타입·lint. 무엇이 격리이고 실제 인증/공유 DB/동시성이 미실행인지 구분 |

UI는 `vocaflow-design-loop`·DESIGN.md의 실제 현재 구성과 저장소 3B 참조를 따른다. 실제 이미지 전후를 보고 비평한다. 골든/외부 참조와 동일하다고 근거 없이 말하지 않는다. PC만 검증한다. 새 진입/제출/복귀 이벤트는 기존 analytics 계약으로 함께 넣고 속성은 숫자·불리언·닫힌 enum만 사용한다. ROUTES/MODULES/LEARNING_MODEL/DB_SCHEMA/CHANGELOG를 필요한 사실만 갱신한다.

단계 2에서 보류 authored SQL의 사람 판단 요구는 AI 판정 사실을 기록하는 호환 경로로 대체하고 DCP SQL과 결합해 시험한다. 단계 1D에서는 human-reviewed를 위조하거나 그 요구를 우회하지 않는다. 공유 DB 적용·발행·main/push·배포는 이번 단계에서 실행하지 않는다.
