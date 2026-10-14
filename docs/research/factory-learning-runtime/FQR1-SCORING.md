# FQR1 채점·피드백·기록 계약

2026-10-15 운영 DB `pg_get_functiondef` 읽기 전용 감사. 실제 채점 호출과 attempt 적재는 0이다. 함수 정의 private 사본과 SHA는 [코드 원장](./data/code-audit.json)에 결속했다. 제품 SQL 파일과 실제 적용 함수는 구분한다.

## 현재 운영 함수

`grade_dcp_item(p_item_id uuid, p_answer jsonb) -> jsonb`는 인증된 사용자를 확인하고 문항 type/key/ref/kind를 읽는다. article 출처는 `csat_source_is_gradeable(ref_id)`가 false면 거부한다. 지원 유형은 **17종**이다.

`order, insert, topic, blank, main_point, title, summary, purpose, implication, content_match, claim, mood, long_order, long_reference, long_match, long_title, long_vocab`.

일곱 어휘·구문 유형은 목록에 없으며 `Unknown type` 예외가 attempt INSERT **앞에서** 발생한다. 현재 함수를 그대로 재사용해 일곱 유형을 채점할 수 있다고 적지 않는다. 유사한 입력 컴포넌트가 있어도 서버 키 이름/인덱스/응답 계약이 다르다.

| 현재 지원 형태 | 입력 | 비교 | 결과 |
|---|---|---|---|
| 문단 order | {order:[presented 인덱스]} | source_order[k]와 제출 위치 비교 | boolean·attempt ID·해설/정답 |
| insert | {position:0부터 시작하는 삽입 슬롯} | key.position과 정수 비교 | 동일 |
| 지문 선택지 15종 | {choice:1..5} | key.answer 비교 | 동일 |

주의할 구현 경계도 남겼다. order SQL은 JOIN 결과의 bool_and를 쓰고 전체 길이·중복·누락·인덱스 범위를 검증하지 않는다. 맞는 접두 부분만 제출해도 참이 나올 수 있는 논리 경로가 존재한다. 이는 SQL 분석 반례이며 운영 채점에 실제 제출하지 않았다. insert도 위치 범위와 key 완전성을 별도 검증하지 않는다. 새 배열/단답 어댑터는 이 불완전한 검사를 복제하지 않는다.

응답은 `{correct:boolean, attempt_id, answer_key}`다. 정답일 때도 `explanation_ko,explanation_writer,rationale_ko`를 null 제거한 객체로 반환한다. 오답이면 전체 해당 문항 key를 반환한다. 정답이면 항상 null이라고 적힌 타입/화면의 일부 옛 주석보다 현재 DB 본문을 우선한다. 키·해설 공개는 제출 후이며 평가 자격 승인과 같지 않다.

## 조회·키 노출 경계

실제 `textbook_practice_items(v_level,limit)`는 id/type/paragraph_idx/payload/ref_title을 반환하며 answer_key를 반환하지 않는다. 유형 17종, article status ready/published, display_only=false, 원천 적격성, 사용자 미시도 조건을 쓴다. 권 단위 `textbook_practice_items_for`는 이번 운영 pg_proc 조회에서 **없음**이었다. 제품에는 pending SQL/순수 선택기가 있지만 적용 사실로 바꾸지 않는다. `fetchVolumePracticeRows`는 PGRST202/42883 함수 없음일 때만 legacy로 가며 권한/네트워크 오류는 조회 실패로 남긴다.

`parseItem`은 지원 유형과 payload를 검증하고 새 DcpItem 객체의 명시된 표시 필드만 직렬화한다. answer_key는 포함하지 않는다. 다만 앞으로 일곱 유형을 추가할 때 기존 DB 행 전체를 client prop으로 넘겨 이 경계를 우회하면 안 된다. 서버 scoring specification과 공개 presentation specification을 분리하고 HTML/RSC/네트워크 payload의 실제 사전 노출 검사를 제품 E2E로 수행해야 한다. 이번에는 실제 브라우저 학생 세션으로 노출을 실험하지 않았다.

## 실패는 오답이 아니다

현재 `gradeDcpItem`은 RPC 오류, null 결과, correct 비불리언을 `{ok:false,error}`로 보존한다. `DcpPlayer`는 예외/ok:false에서 graded가 아니라 answering으로 돌아가 입력을 유지한다. 채점 불가를 correct=false로 바꾸지 않는 흐름은 재사용한다.

새 서버 계약은 최소 `correct / incorrect / partial / indeterminate / scoring_failed / unsupported`를 구별해야 한다. partial은 실제 발문이 요구한 구성 요소와 검증된 부분 채점 규칙이 있을 때만 쓴다. 현재 17종 RPC는 boolean 정오만 반환하므로 부분 수행을 기존 boolean 안에 숨겨 넣지 않는다. 의미 동등 응답의 자동 판정은 이번 작업에서 구현·검증하지 않았다. 대안 표현이 문법적·문맥적으로 허용되면 원래 key와 다르다는 이유만으로 오답이라고 할 수 없다.

서버가 응답 형식/유효 선택 범위/배열 순열/키 존재/콘텐츠 revision/원천 결속/요구 역할 자격을 검사한 뒤 채점해야 한다. 입력 오류와 판정 불가도 학생 능력의 오답 기록으로 쓰지 않는다. 클라이언트 표시 성공을 채점 성공으로 해석하지 않는다.

## 관찰된 저장과 필요한 기록

운영 `csat_item_attempts` 실제 열은 `id,user_id,question_id,text_id,is_correct,error_cause,item_role,responded_at,dcp_item_id` 9개다. 현재 함수는 user/dcp/text/correct/role=practice를 저장한다. 후속 자기보고 error_cause는 vocab/parsing/structure/inference/timing 중 하나다. 자기보고는 자동 진단이나 TASK 능력 판정이 아니다.

실제 제출 응답·콘텐츠 revision·힌트·해설 노출·최초/수정 응답·채점 실패·피드백 전문은 이 열에 없다. 기존 저장만으로 독립 검사/assisted 수행/지연 검사를 재구성했다고 할 수 없다. 연구용 공통 계약은 first_response_freeze, assisted, hint/explanation exposure, revised_response, scorer_version, source/generated hashes, content revision, outcome, attempt/event references를 명시해야 한다. 실제 저장 설계와 마이그레이션은 Claude Code 제품 작업의 별도 범위다.

공개·직접 평가·인간·학생 검증은 이 코드 감사에서 모두 0이다. FQ1.1 연구 Gold를 기존 key나 현재 운영 자동채점의 승인 기록으로 승격하지 않는다.
