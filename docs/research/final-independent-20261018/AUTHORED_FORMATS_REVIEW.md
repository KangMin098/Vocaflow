<!-- docs/research/final-independent-20261018/AUTHORED_FORMATS_REVIEW.md -->
# 과제 형식 레지스트리 독립 검토

고정 대상 `de5065b51e6e0c98c119fdc02afc7142dbd68167`(PR303). **형식 구현은 PARTIAL, 현재 수용 REWORK**. 후속 e91377575는 서버/클라이언트 경계 수정이며 이 검토를 새 HEAD 전체의 수용으로 확대하지 않는다. 실제 DB 쓰기·사람 승인은 수행하지 않았다.

## 확인한 범위

- 고정 커밋을 독립 디렉터리에 추출하고 .env 없이 실제 DB 쓰기 차단 preload를 적용했다. 작성자의 새 formats12/기존 세트 호환14/변경 서버 종단10 = **36건 통과**를 독립 확인했다. 이전 binder16건은 변경되지 않아 반복하지 않았다.
- [독립 실행기](../../../apps/web/scripts/final-independent/probe-authored-formats.mjs)는 각 형식에 맞는 새로운 합성 원문과 Gold/응답을 만들고 실제 FORMAT_SPECS 검증/채점, 실제 AuthoredRunner/CSS, 실제 Chromium을 연결했다. API 저장/결속과 Link만 대체했다. 형식별 정상 응답이 실제 채점기에서 맞게 처리됨을 확인했다.
- [1280/1440 결과](./formats-de5/results.json): 6형식 × 2폭에서 불완전 응답 차단/완성 응답 제출/실제 채점 결과/가로 넘침·활성 요소 높이 확인과 런타임·외부 요청·번들 확인 등50개 관찰이 기대와 일치했다. 44px 미만 활성 요소0, 가로 넘침0, 런타임 오류0, 외부 요청0. browser bundle 입력에 authored Gold JSON은 없었다.
- [1280 선지 대응](./formats-de5/1280-option_correspondence.png)·[1440 문법](./formats-de5/1440-form_scope.png)은 합성 내용의 실제 컴포넌트 화면이다. 실제 CsatShell·인증·Supabase·TASK별 콘텐츠·PLAN 환류 E2E나 참조 디자인 일치/학습 효과를 증명하지 않는다.

| 형식 | 이 검사에서 확인한 정상 응답 계약 |
|---|---|
| central_meaning | 중심 문장 + 근거 + 관계 + 요지 선택 → 기존 R5 정답 판정 |
| choice_evidence | 요지/내용 선택 + 지정 결정 근거 → 정답, 아래 대체 근거 오류 별도 |
| contextual_sense | 문맥 뜻 + 허용 단서 문장 → 정답 |
| sentence_relation | 표시된 문장 쌍의 인과/대조 관계 → 정답 |
| form_scope | 틀린 형태 + 수 일치 이유 → 정답 |
| option_correspondence | 5개 선지 판정 + 정답 선지의 대응 문장 + 불일치 선택 → 정답 |

## FI-012 · 핵심 P2 · OPEN · 동등한 대체 결정 근거의 오답 처리

새 choice_evidence 형식에서 유효한 합성 입력을 구성했다. 기출 원문이나 실제 학습자 응답이 아니다.

- 문장1: The reading room closes at six in the evening.
- 문장2: Its closing time is 6 p.m.
- 문장3: Books can be returned in a box.
- 발문: At what time does the reading room close?
- 답: 6 p.m.
- Gold: decisive=0, evidence=[0], evidenceAlt=[1]. 1부터의 화면 번호와 저장 인덱스(0부터)를 여기서 구별한다.

두 첫 문장은 같은 주체의 동일한 닫는 시간을 각각 직접 진술한다. 따라서 문장2만 선택해도 질문의 답을 완전하게 뒷받침한다. 현재 Gold 구조에서도 문장2는 허용 evidenceAlt로 기록했고 validator는 오류0을 반환한다.

실제 채점 결과는 다음과 같다([원본 결과](./formats-de5/results.json)의 alternativeCounterexample).

| 근거 선택 | choiceOk | decisiveOk | evidenceExtra | isCorrect |
|---|---|---|---|---|
| 문장1만 | true | true | [] | true |
| 의미가 같은 문장2만 | true | false | [] | **false** |
| 문장1+2 | true | true | [] | true |

[추가 UI 결과](./formats-de5/equivalent-evidence-ui.json)와 [1280 화면](./formats-de5/1280-equivalent-evidence.png)·[1440 화면](./formats-de5/1440-equivalent-evidence.png)에서도 문장2만 고른 학습자에게 「이번에는 어긋났어요」가 표시됐다. 이 추가 모드는 기존 정상 상호작용50건을 재실행하지 않고 대체 근거 조합만 확인했다. 관찰 단언 통과는 제품 정답 처리 PASS가 아니다.

원인: grade는 evidenceAlt를 허용 범위에는 넣지만 항상 단일 decisive 인덱스 포함을 요구한다. 현재 형식 계약은 정당한 대체 결정 근거(또는 완전한 대체 근거 집합)를 단독으로 정답 처리하도록 표현할 수 없다. `decisive`를 무엇으로 정해도 나머지 동등한 직접 근거가 배제되는 문제다. 특정 작성자의 문항 선택지 정답이 틀렸다는 주장이 아니라 새 형식이 필수 반례를 처리하지 못한다는 설계/채점 문제다.

기대: 사람이 확정한 완전한 근거 집합/대체 결정 근거를 표현하고, 그 중 하나를 정확히 선택한 응답을 인정한다. 근거가 여러 문장 함께 필요할 때나 보조 단서만 고른 경우는 계속 거절해야 하므로 evidenceAlt의 아무 문장이나 고르면 맞게 하는 완화는 요구하지 않는다. 본문/발문이 같고 뜻이 같은 정당한 대안을 단일 대표 인덱스 때문에 오답 처리하지 않아야 한다.

기존 R5의 중심 문장 재진술 수용은 별도로 유지한다. 새 형식의 능력·루브릭과 실제 세트의 내용/권리/Gold 승인은 각각 확인해야 한다. 수정 소유권은 현재 formats.ts와 새 세트를 구현 중인 총괄 세션에 유지한다.
