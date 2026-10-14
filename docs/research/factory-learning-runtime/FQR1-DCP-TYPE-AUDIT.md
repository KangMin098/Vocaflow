# FQR1 문항 유형·저장 계약 감사

2026-10-15. 제품 worktree `Vocaflow-map-v62`, branch `feat/pf8-bc-hardening`, HEAD `0f2915b4a3534dfa14da8c8ddecf7780f02b85d8`의 실제 코드 33개와 운영 DB 함수 정의를 읽었다. [감사 원장](./data/code-audit.json)의 파일별 SHA와 ignored 로컬 사본을 보존했다. 학습자 입력·채점 RPC 호출·제품 변경은 0이다. 다음은 코드 계약 관찰이며 신규 실제 문항의 정상성 판정은 별도 표본 원장을 참조한다.

## 일곱 주요 유형

DB 행의 `kind`는 출처 종류이고 `type`은 문항 유형이다. 생성 함수 반환 객체의 `kind: 'vocab_choice'`와 저장 행 `kind: 'article', type: 'vocab_choice'`를 혼동하지 않는다. `paragraph_idx`, `sentence_idx`, 원천 `ref_id`도 별도다.

| DB type | 실제 저장 payload | 서버 answer_key | 학습자가 제출해야 할 것 | 현재 제품 연결 |
|---|---|---|---|---|
| vocab_choice | sentences:string[], underlines:{sentenceIdx,word,label}[] | position, original | 표시된 어휘 위치 1개 | 교재 전용·파서/채점 미지원 |
| grammar_choice | sentences:string[], underlines:{sentenceIdx,tokenIdx,word,label}[] | position, original, rule | 표시된 어법 오류 위치 1개 | 교재 전용·파서/채점 미지원 |
| unit_vocab | sentences, choices:{label,text}[], prompt_ko, target | answer | 실제 보기 1개 | 교재 전용·파서/채점 미지원 |
| unit_grammar | sentences, choices:{label,text}[], prompt_ko, underlines | answer, original | 실제 보기/표시 위치 1개 | 교재 전용·파서/채점 미지원 |
| blank_word | stem, hint, context, prompt_ko, sentence_idx | text | 제약에 맞는 낱말 1개 | 교재 전용·파서/채점 미지원 |
| grammar_fix | stem, hint, context, prompt_ko, sentence_idx | text, rule | 수정한 **낱말** 1개 | 교재 전용·파서/채점 미지원 |
| word_order | bank:string[], context, sentence_idx | sentence | 낱말 은행 전체의 순서 | 교재 전용·파서/채점 미지원 |

필드는 저장 경로 `scripts/textbook/store-new-types.mjs`에서 대조했다. `context`와 `hint`는 null일 수 있다. `grammar_fix` 발문은 틀린 낱말을 찾아 고쳐 쓰라고 한다. 현재 정답은 완성 문장이 아니라 수정 낱말이므로 문장 전체 입력을 받는다면 별도 응답·채점 계약이 필요하다. `word_order`의 key는 원래 문장이고 문단 순서 `order`의 `source_order` 배열과 호환되지 않는다.

`vocab_choice`는 다섯 밑줄 중 문맥에 어긋나는 위치를 찾는 형태다. 원문 한 낱말을 바꿔 저장한다. 따라서 생성문과 원천 본문의 동일성만 요구하면 의도한 변형을 오류로 처리한다. 변형 위치·수정 내용·그 밖의 의미 보존·정답 유일성을 따로 확인한다. `grammar_choice` 역시 의도한 오류와 표시 밖의 오류를 분리한다.

현재 `middle-choice.ts`는 `MIDDLE_CHOICES=5`, 생성 `choices`는 객체 배열이다. 기존 재고의 보기 수는 이 상수로 추정하지 않는다. 역사적 생성기는 4지선다였다는 코드 기록이 있고 실제 표본/분포 감사가 필요하다. 3개 또는 4개인 정상 보기에 추가 후보를 만들어 끼우지 않는다. 기존 DCP 파서는 **문자열 choices[5]+passage+stem_ko**를 요구하므로 보기 수만 맞아도 위 유형을 재생할 수 없다.

## 표시와 원천·해설

각 문항은 출처 ID와 현재 원천 본문, 생성된 문장/표시 구간, 서버 정답을 구별해야 한다. 밑줄 `word`만으로 반복 출현 위치가 유일하다고 가정하지 않는다. `tokenIdx`가 없는 어휘 표시는 원래 토큰 위치와 문장 해시를 확인하는 어댑터가 필요하다. `sentence_idx`는 단답/배열 문항을 원천 문단에 결속한다. 생성 당시 원천 revision은 현재 원천 상태와 별도로 확인한다.

해설은 `answer_key.explanation_ko`와 `rationale_ko`로 저장될 수 있다. `pickExplanationText`는 비어 있지 않은 explanation_ko를 우선한다. 조판의 `explain-items.ts`는 저장 해설이 없을 때 유형별 규칙 해설을 만들 수 있지만, 그 함수의 존재가 의미 검토 완료나 저장된 해설의 정확성을 뜻하지 않는다. `unit_grammar`는 저장 시 rule이 빠질 수 있어 `inferRule(original)`을 이용한다. 형태 이름만으로 실제 문장 구조/지시 대상이 확정된다고 하면 FQ1.1의 반례를 되풀이한다. 원천·발문·실제 정답·해설을 함께 검수한다.

## 별도 후속 범위

`elementary.ts`의 rhyme/word_meaning은 `{promptKo,stem,choices:{label,text}[],answer,answerText}`이며 현재 생성기 보기 수는 4다. spell_blank는 보기가 없고 answerText를 쓴다. 초등 즉석 생성·조판 공급과 `csat_dcp_items` 재고를 같은 분모로 세지 않는다. rhyme은 소리 대응, word_meaning은 기본 뜻 재인, spell_blank는 철자 인출이며 V2 문맥 의미 판정의 직접 증거가 아니다. 이 세 유형의 실제 입력/채점 제품 지원은 이번 일곱 유형의 지원 수에 합산하지 않는다.

독해 시리즈의 기존 연습은 order/insert와 지문 선택지 15종을 이용한다. 독해 연습 공급 0과 어휘/구문 12권의 미지원은 같은 원인이 아니다. 유형 허용 목록, 발행, 원천 적격성, 미시도 제외, 후처리, 파서 탈락을 차례로 조사해야 한다. 권별 실제 수량·발행 상태는 별도 [권별 감사](./FQR1-BOOK-GAPS.md)에서 보고한다.

## 공개·검증 경계

신규 표본의 정상/결함 수, 인간 검수, 학생 실행, 권리 승인을 코드 주석의 옛 수치로 채우지 않았다. 여기서 미지원은 기술 계약 상태이며 학생의 오답이나 콘텐츠의 전면적 무가치 판정이 아니다. 자료 역할과 FQ A~H, 노출, 실제 학습 효과는 별도 검증 대상이다.
