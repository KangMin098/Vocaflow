# FQR1 공통 학습 실행 계약

`LearningActivitySpecification`은 문항을 표시하는 구조, 채점 근거, 실제 공급 자격을 분리한다. [JSON Schema](data/learning-activity.schema.json), [실제14문항의 metadata 계약](data/runtime-contracts.json), [참조 검사기](../../../scripts/research/factory-learning-runtime/activity.mjs)를 제공한다. 실제 자극을 포함한 14개 정규화 명세는 ignored local에만 있다. 제품 플레이어를 구현하거나 DCP를 수정하지 않았다.

## 필드와 신뢰 경계

| 필드 | 의미·결속 |
|---|---|
| content/source/generated_sha256 | 콘텐츠 ID·snapshot revision·원천/생성물 hash. snapshot은 생성 당시 revision의 증명이 아님 |
| series | 실제 배정 권/단계. 이번 pool 표본은 id/step null·unassigned이며 임의로 출판 권에 배정하지 않음 |
| dcp_type/TASK/purpose/role | 실제 유형·관찰 수행·교육 목적·자료 역할. TASK tag와 직접 수행 증거 분리 |
| presentation | 원래 자극/표시/보기 수·발문·명시 요청 산출물 |
| input | marked_selection/choice/short_text/token_order의 응답 구조 |
| answer_qualification/scoring | 서버 secret 참조·명시 대안·정규화·채점 경로·부분 채점 지원 |
| feedback/help | 검수된 해설 참조·학생 산출과 일치·봉인 뒤 공개·원래 문제 단서와 추가 힌트 구별 |
| learner_exposure/runtime/FQ | 실제 서버 노출·실행 지원·A–H 자격 참조. 구조 통과만으로 공개/평가 승인하지 않음 |

서버의 키와 대안 목록은 초기 presentation에 넣지 않는다. 공개 입력은 원문의 선택지·표시를 그대로 보존하고 정답 위치·복원 낱말·허용 문장 순열은 서버에 둔다. 현행 공개 fetch도 키를 whitelist에서 제외한다. 브라우저 실행을 통한 노출 검증은 별도다.

## 유형별 실제 변환

| 실제 유형/키 | 공통 입력 | 서버 비교 근거 | 필수 어댑터 경계 |
|---|---|---|---|
| vocab_choice / position+original | marked_selection `{option_id}` | 1-based position→명시 option ID | sentences·underlines의 실제 표시/문장 주소; 문맥상 유일성 검수 |
| grammar_choice / position+original+rule | marked_selection `{option_id}` | 위와 동일 | tokenIdx·동일 낱말 반복·대체문 가능 해석; rule 검수 |
| unit_vocab / answer | choice `{option_id}` | 실제 choices 배열의 1-based answer | 실제 보기 수 유지, 기본 뜻/문맥 뜻 구별 |
| unit_grammar / answer+original | choice `{option_id}` | 실제 choices 배열의 answer | sentence/underline와 교체 보기의 결속 |
| blank_word / text | short_text `{text}` | 검수된 text·명시 대안 | 원래 stem/단서/context; 대소문자·공백 정책 |
| grammar_fix / text+rule | short_text `{text}` | 수정 낱말·명시 대안 | 낱말 응답/전체 문장 재작성 구별; 다른 문법 해석 보류 |
| word_order / sentence | token_order `{token_ids}` | 검수된 전체 배열/문장 대안 | bank occurrence ID, 전체 길이·누락·중복·범위·의미 보존 |

실제14개 선택형 보기/표시는 모두5개였다. 3개 보기 fixture는 실제 사례라고 주장하지 않고 다른 개수도 보존하는 계약 검사다. 가짜 4/5번째 보기를 생성하지 않는다. 동일한 낱말이 bank에 두 번 나타나면 occurrence ID를 각각 부여하되 같은 낱말끼리 교환해 동일 문장이 되는 경우 오답으로 만들지 않는다.

nullable hint/context는 실제 grammar_fix/word_order 자료에 존재한다. null만으로 구조 오류라고 하지 않는다. 반대로 표시할 수 있다는 이유로 제목 조각·약어 절단·불완전 절을 완전한 문장 과제로 인정하지 않는다. 구조 검사와 실제 의미 검수는 별도다.

## 응답·채점·피드백 순서

1. 공급 서버가 유형/권 배정/artifact revision/권리·내용·역할·학습자 노출/실행 지원을 검증한다.
2. 원래 자극·발문·문제의 기본 단서를 제공한다. 별도 추가 힌트는 검수·로그가 필요하다.
3. 최초 응답을 서버에서 봉인한다. 현재 API 기록에는 원응답/revision/도움 로그가 없어 보강이 필요하다.
4. 지도 연습에서 추가 힌트·수정 응답은 assisted로 기록한다. 과거 첫 응답을 덮지 않는다.
5. 최종 지도 응답을 봉인한 뒤 정답·완전한 검수 해설을 제공한다.
6. 근거 설명을 추가 활동으로 요청할 수 있다. 정답을 본 뒤 설명은 독립 수행 증거가 아니다.
7. 원래 권/Workspace/TASK로 복귀한다. 서버에 결속된 origin reference로 복귀하고 다른 문항/사용자 공급 이력을 섞지 않는다.

현재 핵심7유형의 실제 RPC 지원은0이다. 참조 `evaluateResponse`의 `proposed_reference_comparison`은 순수 연구 fixture용이며 새 운영 서버 채점기 완성·승인을 뜻하지 않는다. 실제 유형을 legacy 문단 order/선택형으로 이름만 바꿔 호출하지 않는다.

## 결과와 오류

참조 결과는 `outcome=correct/incorrect/partial/defer/scoring_error`, `operation_status=scored/deferred/failed/unsupported`, `error_code`, item-level correct, 오답 저장 여부, TASK 증거 없음으로 구성한다. unsupported는 기술 실패의 별도 operation_status와 사유로 보존한다. 기존 RPC `{correct,attempt_id,answer_key}`와 Action `{ok,correct,attemptId,answerKey}`를 구별한다. DB attempt의 `is_correct`를 RPC 응답 필드로 오해하지 않는다.

키 누락·미지원·형식 오류·RPC 실패는 incorrect가 아니다. 등록되지 않은 의미 동등 대안이나 문법적 대체문은 defer/검수 대기다. 정확한 부분 수행을 채점하려면 학생에게 요청한 구성 요소와 검증된 부분 루브릭이 있어야 한다. 현재 저장 키만으로 자동 부분 채점을 하지 않는다.

`graded_attempt_allowed`는 순수 비교 결과의 표현 가능성을 뜻한다. 실제 기록 권한/인간 Gold/학생 평가 자격을 부여하지 않으며 DB 저장은 제품 서버의 별도 권한·FQ·idempotency 경계를 통과해야 한다. 이번 연구에서 actual scorer/attempt 호출은0이다.

## 실행 지원 상태

실제14개는 기존 runner 지원0, runner adapter 필요14, scoring contract 필요14, qualification 필요14, 권 배정 필요14다. word_order2개는 token-order 입력 계약도 필요하다. 두 검토 중 B/E 실패가 있는8개는 content repair, 두 검토 모두 B/E 통과4개도 실제 공급/평가 승인0이다. 상태는 여러 요구 조건을 함께 가질 수 있으며 각각의14를 더해 문항 수로 세지 않는다.

meaning_explanation/meaning_contrast/guided_steps는 후속 입력·채점 계약으로 분류한다. 이번 schema/참조 grader는 자연어 의미 판정이나 숙달 판정기를 구현하지 않는다.

```powershell
node --test scripts/research/factory-learning-runtime/activity.test.mjs scripts/research/factory-learning-runtime/contracts.test.mjs
node scripts/research/factory-learning-runtime/contracts.mjs --check
```
