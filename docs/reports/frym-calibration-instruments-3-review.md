# FYM calibration 문항 검토본 revision 3

**책임자·문항 검토자 전용. 학생·blind 의미 평가자에게 이 파일을 보내지 않는다.** 원천/학년 대응과 채점 기준이 들어 있다. 아래는 에이전트가 작성한 개정 초안이며 사람 승인·학생 난이도 인증이 아니다. 기존 pilot 본문과 v1/default 문항은 변경하지 않았다.

문항별 인용은 채점 근거이며 학생에게 별도 힌트로 제시하지 않는다. 학생에게는 등록 후 재생성한 패킷의 지문과 질문만 사용한다. 질문에 인용된 syntax 문장은 문항 자체의 일부이다. 의미 평가자는 학생 문항/채점 기준 없이 원 연구 문맥과 각색문만 독립 평가한다.

정답 표현은 예시이며 의미가 같은 한국어/영어 답을 인정한다. 무응답은 null이다. 부분 답은 문항별 0.5점 anchor로 판단한다. 규정에 없는 경계 답은 사후 기준을 바꾸기보다 쟁점으로 보존하고 사람 책임자가 봉인된 처리 규칙에 따라 다룬다.

pilot SHA256: 44c79e4ea80669ecfe395f1f8e0ba283058723b60d3806cdd740ea5907630031
문항 파일 SHA256: 919eefd4b9387784f8777d50dee6d5c82884979f08c0e49ff140c101a2c7b742

## 전수 점검 범위

8편·96문항(어휘/문장/추론/명시 정보 각 24문항)을 모두 비교했다. issue 코드는 중복 집계한 검토 필요 사유이며 교육적 실패율이 아니다.

- PARTIAL_CREDIT_UNSPECIFIED: 96문항
- WHOLE_PASSAGE_EVIDENCE: 72문항
- GENERIC_SYNTAX_RUBRIC: 24문항
- SHARED_REASONING_RUBRIC: 24문항
- CONCLUSION_HINT_OR_MULTI_DEMAND: 24문항
- RETRIEVAL_REASONING_OVERLAP: 8문항
- ACCEPTABLE_ANSWER_REVIEW: 2문항
- DEFINITION_NOT_EXPLICIT: 1문항

## F02-middle1

본문 SHA256: fd58cbf22bc930b64a8a06dedfe708cbb9cb7c1d69360226deec3b708a4539cf

Imagine choosing a packet of sweets from a shop shelf. Your eyes help you find the packet and see where it is. When you reach for it, touch helps you feel whether you are holding it firmly. The two senses give you different kinds of information. Both are useful in the same simple action.

Touch also gives information about your body and its position. Vision gives information about the world around you and helps you find your way through it. These roles are different. Saying that one sense is always the most important would hide this difference.

We may notice what we see more often than what we feel. However, noticing a sense often is not the same as showing that it is more important for every task. A sense can help us even when we are not paying close attention to it.

The main idea is to look at what each sense does. Instead of asking only which sense should win a contest, ask what information you need for a particular action. Finding an object and holding it involve different needs. Thinking about those needs helps us understand why several senses matter in daily life.

### R1 · reasoning

시각이 봉지를 찾는 데 도움이 된다는 예만으로 시각이 모든 활동에서 가장 중요하다고 결론 내릴 수 있나요? 이유도 쓰세요.

근거 인용:

> Your eyes help you find the packet and see where it is. When you reach for it, touch helps you feel whether you are holding it firmly. The two senses give you different kinds of information. Both are useful in the same simple action.

채점 초안: 1점: 아니오 + 봉지 찾기와 다른 활동은 필요한 감각 정보가 다르다는 근거. 0.5점: 아니오만 쓰거나 활동별 필요 근거만 정확. 0점: 예 하나로 모든 활동의 우열이 입증되었다고 주장 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### R2 · reasoning

사람이 자주 알아차리는 감각을 가장 중요한 감각이라고 정하려면 어떤 연결이 더 필요하나요? 글의 설명을 이용해 답하세요.

근거 인용:

> We may notice what we see more often than what we feel. However, noticing a sense often is not the same as showing that it is more important for every task. A sense can help us even when we are not paying close attention to it.

채점 초안: 1점: 알아차리는 빈도만으로 특정 활동에 필요한 도움/기능의 크기가 입증되지는 않는다는 설명. 0.5점: 자주 알아차림과 도움이 다르다고만 쓰고 활동/기능과의 연결이 빠짐. 0점: 자주 알아차리면 항상 더 중요하다고 결론 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### R3 · reasoning

이 글의 핵심 설명 또는 연구 결과를 요약하는 결론 중 지지되는 결론 하나와 지지되지 않는 더 강한 결론 하나를 구별해 쓰세요.

근거 인용:

> Touch also gives information about your body and its position. Vision gives information about the world around you and helps you find your way through it. These roles are different. Saying that one sense is always the most important would hide this difference.

채점 초안: 1점: 본문이 지지하는 주요 설명/결과와 그것을 부당하게 강화한 결론을 정확히 구별. 예시: 감각별 역할/활동별 필요를 살펴야 함 + 한 감각이 모든 활동의 절대 승자라는 결론은 지지되지 않음. 예시는 유일한 정답이 아니다. 범위·인과·확실성 중 다른 측면을 강화한 타당한 결론 쌍도 인정하며 예시의 모든 한계를 나열할 필요는 없다. 0.5점: 지지/비지지 중 하나만 정확히 구별. 0점: 두 결론의 지지 여부를 뒤집음 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### C1 · comprehension

글에서 시각과 촉각이 봉지를 다룰 때 각각 하는 일을 쓰세요.

근거 인용:

> Your eyes help you find the packet and see where it is. When you reach for it, touch helps you feel whether you are holding it firmly.

채점 초안: 1점: 봉지를 찾는 시각 + 단단히 잡고 있는지를 느끼는 촉각. 0.5점: 두 역할 중 하나만 정확. 0점: 역할을 서로 바꾸거나 글과 관계없는 역할만 제시 또는 관련 없는 답. 판정 우선순위: 요청한 단위 중 일부는 맞고 나머지가 틀리거나 빠진 혼합 답은 0.5점이다. 아래 0점 예시에 해당하는 오류가 섞여도 정확한 요구 단위가 하나 이상 있으면 0.5점이며, 0점은 맞은 요구 단위가 전혀 없는 경우이다. 같은 단위에 서로 모순되는 답을 함께 쓰면 그 단위는 정답으로 인정하지 않는다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### C2 · comprehension

글에서 두 감각의 역할을 보여 주는 물건과 그 물건이 놓인 장소를 쓰세요.

근거 인용:

> Imagine choosing a packet of sweets from a shop shelf.

채점 초안: 1점: 봉지(packet) + 상점 선반. 0.5점: 물건 또는 장소 중 하나만 정확; 사탕 내용물은 요구하지 않음. 0점: 물건/장소 모두 틀림 또는 관련 없는 답. 판정 우선순위: 요청한 단위 중 일부는 맞고 나머지가 틀리거나 빠진 혼합 답은 0.5점이다. 아래 0점 예시에 해당하는 오류가 섞여도 정확한 요구 단위가 하나 이상 있으면 0.5점이며, 0점은 맞은 요구 단위가 전혀 없는 경우이다. 같은 단위에 서로 모순되는 답을 함께 쓰면 그 단위는 정답으로 인정하지 않는다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### C3 · comprehension

글은 감각의 순위를 정하는 대신 무엇을 살펴보라고 제안하나요?

근거 인용:

> The main idea is to look at what each sense does. Instead of asking only which sense should win a contest, ask what information you need for a particular action. Finding an object and holding it involve different needs.

채점 초안: 1점: 각 감각의 기능/역할과 특정 활동의 필요를 살펴보자. 0.5점: 감각의 기능 또는 활동의 필요 중 하나만 정확. 0점: 시각/촉각 중 절대 승자를 고르자고 해석 또는 관련 없는 답. 판정 우선순위: 요청한 단위 중 일부는 맞고 나머지가 틀리거나 빠진 혼합 답은 0.5점이다. 아래 0점 예시에 해당하는 오류가 섞여도 정확한 요구 단위가 하나 이상 있으면 0.5점이며, 0점은 맞은 요구 단위가 전혀 없는 경우이다. 같은 단위에 서로 모순되는 답을 함께 쓰면 그 단위는 정답으로 인정하지 않는다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### L1 · lexical

이 글에서 sense가 뜻하는 바를 한국어 또는 쉬운 영어로 설명하세요.

근거 인용:

> Imagine choosing a packet of sweets from a shop shelf. Your eyes help you find the packet and see where it is. When you reach for it, touch helps you feel whether you are holding it firmly. The two senses give you different kinds of information. Both are useful in the same simple action.

채점 초안: 1점: 감각 또는 시각·촉각처럼 정보를 받아들이는 방식; 정확한 번역 감각만 써도 인정. 0.5점: 시각/촉각 중 예 하나만 쓰고 뜻을 설명하지 않은 경우. 0점: 의견·분별력 등 이 글의 감각과 다른 뜻 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### L2 · lexical

이 글에서 information가 뜻하는 바를 한국어 또는 쉬운 영어로 설명하세요.

근거 인용:

> Touch also gives information about your body and its position. Vision gives information about the world around you and helps you find your way through it.

채점 초안: 1점: 정보 또는 감각을 통해 알게 되는 몸/주변 세계에 관한 내용; 정보만 써도 인정. 0.5점: 어떤 것이 있다는 소식/자료처럼 정보의 일부 의미만 설명. 0점: 정보의 뜻 대신 감각의 우열만 주장 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### L3 · lexical

이 글에서 important가 뜻하는 바를 한국어 또는 쉬운 영어로 설명하세요.

근거 인용:

> These roles are different. Saying that one sense is always the most important would hide this difference.

채점 초안: 1점: 중요한/가치 있는/도움이 되는; 중요한만 써도 인정. 0.5점: 좋은 것이라고만 하여 긍정적 평가는 있지만 중요성/유용성의 뜻은 빠진 경우. 0점: 유명한/크기가 큰 등 다른 뜻 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### S1 · syntax

when 절의 상황과 whether 절에서 확인하는 내용을 각각 설명하세요.
"When you reach for it, touch helps you feel whether you are holding it firmly."

근거 인용:

> When you reach for it, touch helps you feel whether you are holding it firmly.

채점 초안: 1점: 봉지를 향해 손을 뻗는 상황 + 봉지를 단단히 잡고 있는지를 촉각으로 확인. 0.5점: 상황/확인 내용 중 하나만 정확하고 다른 하나를 빠뜨림. 0점: 촉각이 봉지의 위치를 눈으로 찾는다는 등 역할이나 여부 의미를 바꿈 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### S2 · syntax

not the same as가 비교하는 두 내용을 각각 쓰고, 두 내용의 관계를 설명하세요.
"However, noticing a sense often is not the same as showing that it is more important for every task."

근거 인용:

> However, noticing a sense often is not the same as showing that it is more important for every task.

채점 초안: 1점: 감각을 자주 알아차림과 모든 활동에서 더 중요하다고 입증함을 구별하며 같지 않다고 설명. 0.5점: 두 내용 중 하나와 같지 않다는 관계만 정확. 0점: 자주 알아차리면 모든 활동에서 더 중요하다고 입증된다고 반대로 해석 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### S3 · syntax

what each sense does가 뜻하는 내용을 쓰고, 문장 전체가 제안하는 관점을 설명하세요.
"The main idea is to look at what each sense does."

근거 인용:

> The main idea is to look at what each sense does.

채점 초안: 1점: 각 감각이 하는 역할을 살펴보자는 관점. 0.5점: 감각의 역할만 쓰고 살펴보자는 관점이 빠짐. 0점: 어느 감각이 항상 우승하는지 결정하자는 뜻으로 해석 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

## F02-high1

본문 SHA256: f21a7b5856c9fe048a5279ae60bb56513ed92e3c9f0eb96a4acacfb6462611b7

A claim that vision is our most important sense may sound simple. Yet the word important needs a clear meaning. Important for finding a place? Important for feeling the position of our bodies? Changing the question can change the answer.

Vision helps us notice things around us and find our way toward them. Touch gives information about how our bodies meet the world. Consider a packet on a shop shelf. Seeing helps us find it. Touch helps us feel whether our fingers are holding it firmly. These are different parts of one action.

The difference matters when we judge a general claim. An example showing that vision helps with one task does not establish that it is the best sense for every task. Likewise, an example showing the value of touch does not make touch the universal winner.

The explanation therefore moves from ranking senses to comparing their functions. This change does not make vision unimportant. It shows why a single ranking may leave out useful information. To evaluate the original claim, a reader should ask which task or need the speaker has in mind. Without that condition, the word important can cover several different ideas.

### R1 · reasoning

시각이 봉지를 찾는 데 도움이 된다는 예만으로 시각이 모든 활동에서 가장 중요하다고 결론 내릴 수 있나요? 이유도 쓰세요.

근거 인용:

> The difference matters when we judge a general claim. An example showing that vision helps with one task does not establish that it is the best sense for every task. Likewise, an example showing the value of touch does not make touch the universal winner.

채점 초안: 1점: 아니오 + 봉지 찾기와 다른 활동은 필요한 감각 정보가 다르다는 근거. 0.5점: 아니오만 쓰거나 활동별 필요 근거만 정확. 0점: 예 하나로 모든 활동의 우열이 입증되었다고 주장 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### R2 · reasoning

어떤 활동인지 말하지 않은 채 한 감각이 중요하다고만 하면, 그 주장을 평가하기 어려운 이유는 무엇인가요?

근거 인용:

> To evaluate the original claim, a reader should ask which task or need the speaker has in mind. Without that condition, the word important can cover several different ideas.

채점 초안: 1점: 활동/필요가 명확하지 않으면 important가 여러 뜻을 가지며 감각의 기능과 필요한 도움을 비교할 기준이 불명확해짐. 0.5점: 활동을 알아야 한다/중요함의 뜻이 여러 개라는 것 중 하나만 설명. 0점: 활동과 상관없이 감각의 절대 우열을 정할 수 있다고 주장 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### R3 · reasoning

이 글의 핵심 설명 또는 연구 결과를 요약하는 결론 중 지지되는 결론 하나와 지지되지 않는 더 강한 결론 하나를 구별해 쓰세요.

근거 인용:

> The difference matters when we judge a general claim. An example showing that vision helps with one task does not establish that it is the best sense for every task. Likewise, an example showing the value of touch does not make touch the universal winner.

채점 초안: 1점: 본문이 지지하는 주요 설명/결과와 그것을 부당하게 강화한 결론을 정확히 구별. 예시: 감각별 역할/활동별 필요를 살펴야 함 + 한 감각이 모든 활동의 절대 승자라는 결론은 지지되지 않음. 예시는 유일한 정답이 아니다. 범위·인과·확실성 중 다른 측면을 강화한 타당한 결론 쌍도 인정하며 예시의 모든 한계를 나열할 필요는 없다. 0.5점: 지지/비지지 중 하나만 정확히 구별. 0점: 두 결론의 지지 여부를 뒤집음 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### C1 · comprehension

글에서 시각과 촉각이 봉지를 다룰 때 각각 하는 일을 쓰세요.

근거 인용:

> Vision helps us notice things around us and find our way toward them. Touch gives information about how our bodies meet the world. Consider a packet on a shop shelf. Seeing helps us find it. Touch helps us feel whether our fingers are holding it firmly. These are different parts of one action.

채점 초안: 1점: 봉지를 찾는 시각 + 단단히 잡고 있는지를 느끼는 촉각. 0.5점: 두 역할 중 하나만 정확. 0점: 역할을 서로 바꾸거나 글과 관계없는 역할만 제시 또는 관련 없는 답. 판정 우선순위: 요청한 단위 중 일부는 맞고 나머지가 틀리거나 빠진 혼합 답은 0.5점이다. 아래 0점 예시에 해당하는 오류가 섞여도 정확한 요구 단위가 하나 이상 있으면 0.5점이며, 0점은 맞은 요구 단위가 전혀 없는 경우이다. 같은 단위에 서로 모순되는 답을 함께 쓰면 그 단위는 정답으로 인정하지 않는다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### C2 · comprehension

글에서 두 감각의 역할을 보여 주는 물건과 그 물건이 놓인 장소를 쓰세요.

근거 인용:

> Consider a packet on a shop shelf.

채점 초안: 1점: 봉지(packet) + 상점 선반. 0.5점: 물건 또는 장소 중 하나만 정확; 사탕 내용물은 요구하지 않음. 0점: 물건/장소 모두 틀림 또는 관련 없는 답. 판정 우선순위: 요청한 단위 중 일부는 맞고 나머지가 틀리거나 빠진 혼합 답은 0.5점이다. 아래 0점 예시에 해당하는 오류가 섞여도 정확한 요구 단위가 하나 이상 있으면 0.5점이며, 0점은 맞은 요구 단위가 전혀 없는 경우이다. 같은 단위에 서로 모순되는 답을 함께 쓰면 그 단위는 정답으로 인정하지 않는다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### C3 · comprehension

글은 감각의 순위를 정하는 대신 무엇을 살펴보라고 제안하나요?

근거 인용:

> The explanation therefore moves from ranking senses to comparing their functions. This change does not make vision unimportant. It shows why a single ranking may leave out useful information.

채점 초안: 1점: 각 감각의 기능/역할과 특정 활동의 필요를 살펴보자. 0.5점: 감각의 기능 또는 활동의 필요 중 하나만 정확. 0점: 시각/촉각 중 절대 승자를 고르자고 해석 또는 관련 없는 답. 판정 우선순위: 요청한 단위 중 일부는 맞고 나머지가 틀리거나 빠진 혼합 답은 0.5점이다. 아래 0점 예시에 해당하는 오류가 섞여도 정확한 요구 단위가 하나 이상 있으면 0.5점이며, 0점은 맞은 요구 단위가 전혀 없는 경우이다. 같은 단위에 서로 모순되는 답을 함께 쓰면 그 단위는 정답으로 인정하지 않는다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### L1 · lexical

이 글에서 sense가 뜻하는 바를 한국어 또는 쉬운 영어로 설명하세요.

근거 인용:

> A claim that vision is our most important sense may sound simple.

채점 초안: 1점: 감각 또는 시각·촉각처럼 정보를 받아들이는 방식; 정확한 번역 감각만 써도 인정. 0.5점: 시각/촉각 중 예 하나만 쓰고 뜻을 설명하지 않은 경우. 0점: 의견·분별력 등 이 글의 감각과 다른 뜻 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### L2 · lexical

이 글에서 information가 뜻하는 바를 한국어 또는 쉬운 영어로 설명하세요.

근거 인용:

> It shows why a single ranking may leave out useful information.

채점 초안: 1점: 정보 또는 감각을 통해 알게 되는 몸/주변 세계에 관한 내용; 정보만 써도 인정. 0.5점: 어떤 것이 있다는 소식/자료처럼 정보의 일부 의미만 설명. 0점: 정보의 뜻 대신 감각의 우열만 주장 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### L3 · lexical

이 글에서 important가 뜻하는 바를 한국어 또는 쉬운 영어로 설명하세요.

근거 인용:

> A claim that vision is our most important sense may sound simple. Yet the word important needs a clear meaning. Important for finding a place? Important for feeling the position of our bodies? Changing the question can change the answer.

채점 초안: 1점: 중요한/가치 있는/도움이 되는; 중요한만 써도 인정. 0.5점: 좋은 것이라고만 하여 긍정적 평가는 있지만 중요성/유용성의 뜻은 빠진 경우. 0점: 유명한/크기가 큰 등 다른 뜻 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### S1 · syntax

두 that 절의 내용을 각각 쓰고 does not establish가 둘 사이에 만드는 관계를 설명하세요.
"An example showing that vision helps with one task does not establish that it is the best sense for every task."

근거 인용:

> An example showing that vision helps with one task does not establish that it is the best sense for every task.

채점 초안: 1점: 한 활동에서 시각이 도움이 됨과 모든 활동에서 시각이 최고임을 구별하며 전자가 후자를 입증하지 않음. 0.5점: 두 내용은 맞지만 입증 관계가 빠짐, 또는 관계는 맞지만 한 내용만 제시. 0점: 한 활동의 도움으로 모든 활동의 우열이 입증된다고 반대로 해석 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### S2 · syntax

To evaluate의 목적과 which 절에서 확인해야 할 내용을 각각 설명하세요.
"To evaluate the original claim, a reader should ask which task or need the speaker has in mind."

근거 인용:

> To evaluate the original claim, a reader should ask which task or need the speaker has in mind.

채점 초안: 1점: 원래 주장을 평가하기 위한 목적 + 말하는 사람이 어떤 활동/필요를 염두에 두는지 확인. 0.5점: 목적 또는 확인 내용 중 하나만 정확. 0점: 화자가 누구인지/어떤 감각이 항상 이기는지를 확인한다고 해석 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### S3 · syntax

that condition이 가리키는 내용을 쓰고 Without이 붙으면 어떤 상황이 되는지 설명하세요.
"To evaluate the original claim, a reader should ask which task or need the speaker has in mind. Without that condition, the word important can cover several different ideas."

근거 인용:

> To evaluate the original claim, a reader should ask which task or need the speaker has in mind. Without that condition, the word important can cover several different ideas.

채점 초안: 1점: 활동이나 필요를 명확히 하는 조건이 없으면 important가 여러 뜻을 포함할 수 있음. 0.5점: 조건의 지시 대상 또는 없을 때의 결과 중 하나만 정확. 0점: 조건이 있으면 항상 한 감각이 최고라는 등 조건과 결과를 바꿈 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

## F06-middle1

본문 SHA256: 1cb6731278136c9e675bfa7ad136a06129b950cdb234ff5660180acbd96bd28b

Growing plants in a city can have a role beyond producing food. City gardens can offer places where birds and helpful insects stay. Such places are called habitats. They provide space for living things within a city.

Biodiversity means the variety of living things. Providing habitats can help support that variety. This is one possible function of urban agriculture, which means growing food in or near a city. A garden can therefore be discussed both as a place to grow plants and as a place for other living things.

The research review behind this explanation focused on projects in the Global North. It described several functions of urban agriculture. Its scope matters: the review does not show that every garden in every part of the world produces the same result.

When reading about this benefit, keep the word can in mind. A possible benefit is different from a promise about all gardens. The idea here is specific: growing plants in cities can provide habitats and help support biodiversity. It does not establish every other claim about city farming. Understanding this limited idea gives us a clear way to describe one role of a city garden.

### R1 · reasoning

이 연구의 설명을 모든 지역의 모든 정원에 그대로 적용하려는 주장에 동의하나요? 이유도 쓰세요.

근거 인용:

> The research review behind this explanation focused on projects in the Global North. It described several functions of urban agriculture. Its scope matters: the review does not show that every garden in every part of the world produces the same result.

채점 초안: 1점: 동의하지 않음 + Global North를 다룬 검토/가능한 기능의 설명이 전 세계 동일 효과를 입증하지 않음. 0.5점: 반대만 쓰거나 연구 범위/가능성의 한계 근거만 정확. 0점: 어디서나 동일 효과가 보장된다고 주장 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### R2 · reasoning

요약에서 can을 will로 바꾸면 독자가 받아들이는 주장의 강도는 어떻게 달라지나요? 이 글의 근거와 연결해 설명하세요.

근거 인용:

> When reading about this benefit, keep the word can in mind. A possible benefit is different from a promise about all gardens. The idea here is specific: growing plants in cities can provide habitats and help support biodiversity.

채점 초안: 1점: 가능한 효과에서 보장/단정된 효과로 강해짐 + 연구는 그 보장을 뒷받침하지 않음. 0.5점: 강해진다는 변화 또는 근거가 보장을 지지하지 않음 중 하나만 정확. 0점: 아무 변화가 없거나 연구가 보장을 입증한다고 설명 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### R3 · reasoning

이 글의 핵심 설명 또는 연구 결과를 요약하는 결론 중 지지되는 결론 하나와 지지되지 않는 더 강한 결론 하나를 구별해 쓰세요.

근거 인용:

> When reading about this benefit, keep the word can in mind. A possible benefit is different from a promise about all gardens. The idea here is specific: growing plants in cities can provide habitats and help support biodiversity. It does not establish every other claim about city farming.

채점 초안: 1점: 본문이 지지하는 주요 설명/결과와 그것을 부당하게 강화한 결론을 정확히 구별. 예시: 도시 정원이 서식지/다양성을 지원할 수 있음 + 모든 정원이 어디서나 같은 다양성 효과를 낸다는 결론은 지지되지 않음. 예시는 유일한 정답이 아니다. 범위·인과·확실성 중 다른 측면을 강화한 타당한 결론 쌍도 인정하며 예시의 모든 한계를 나열할 필요는 없다. 0.5점: 지지/비지지 중 하나만 정확히 구별. 0점: 보편적 보장만을 연구 결론으로 제시 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### C1 · comprehension

글에서 정원이 서식 장소를 제공할 수 있는 생물의 예 두 가지를 쓰세요.

근거 인용:

> City gardens can offer places where birds and helpful insects stay.

채점 초안: 1점: 새 + 유익한 곤충. 0.5점: 두 예 중 하나만 정확. 0점: 식량/사람 등 글에 제시되지 않은 예만 제시 또는 관련 없는 답. 판정 우선순위: 요청한 단위 중 일부는 맞고 나머지가 틀리거나 빠진 혼합 답은 0.5점이다. 아래 0점 예시에 해당하는 오류가 섞여도 정확한 요구 단위가 하나 이상 있으면 0.5점이며, 0점은 맞은 요구 단위가 전혀 없는 경우이다. 같은 단위에 서로 모순되는 답을 함께 쓰면 그 단위는 정답으로 인정하지 않는다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### C2 · comprehension

원래 연구의 종류와 다룬 지역을 글에서 찾아 쓰세요.

근거 인용:

> The research review behind this explanation focused on projects in the Global North. It described several functions of urban agriculture.

채점 초안: 1점: 기존 자료를 검토한 review + Global North. 0.5점: 연구 종류 또는 지역 중 하나만 정확. 0점: 전 세계 모든 정원을 대상으로 한 새 실험이라고 해석 또는 관련 없는 답. 판정 우선순위: 요청한 단위 중 일부는 맞고 나머지가 틀리거나 빠진 혼합 답은 0.5점이다. 아래 0점 예시에 해당하는 오류가 섞여도 정확한 요구 단위가 하나 이상 있으면 0.5점이며, 0점은 맞은 요구 단위가 전혀 없는 경우이다. 같은 단위에 서로 모순되는 답을 함께 쓰면 그 단위는 정답으로 인정하지 않는다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### C3 · comprehension

도시 농업의 역할로 글에서 제시한 두 가지를 쓰세요.

근거 인용:

> Providing habitats can help support that variety. This is one possible function of urban agriculture, which means growing food in or near a city. A garden can therefore be discussed both as a place to grow plants and as a place for other living things.

채점 초안: 1점: 먹거리/식물 생산 + 생물 서식지 제공/다양성 지원. 0.5점: 두 역할 중 하나만 정확. 0점: 글에 없는 효과만 나열 또는 관련 없는 답. 판정 우선순위: 요청한 단위 중 일부는 맞고 나머지가 틀리거나 빠진 혼합 답은 0.5점이다. 아래 0점 예시에 해당하는 오류가 섞여도 정확한 요구 단위가 하나 이상 있으면 0.5점이며, 0점은 맞은 요구 단위가 전혀 없는 경우이다. 같은 단위에 서로 모순되는 답을 함께 쓰면 그 단위는 정답으로 인정하지 않는다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### L1 · lexical

이 글에서 habitats가 뜻하는 바를 한국어 또는 쉬운 영어로 설명하세요.

근거 인용:

> City gardens can offer places where birds and helpful insects stay. Such places are called habitats. They provide space for living things within a city.

채점 초안: 1점: 생물이 살거나 머무는 장소/서식지. 0.5점: 장소라고만 하여 생물과의 관련이 빠진 경우. 0점: 먹이/생물의 종류 등 장소와 다른 뜻 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### L2 · lexical

이 글에서 biodiversity가 뜻하는 바를 한국어 또는 쉬운 영어로 설명하세요.

근거 인용:

> Biodiversity means the variety of living things. Providing habitats can help support that variety.

채점 초안: 1점: 생물의 다양한 종류 또는 생물 다양성. 0.5점: 생물이 많다라고만 쓰고 종류의 다양성을 밝히지 않은 경우. 0점: 도시의 수/식량 생산량 등 다른 뜻 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### L3 · lexical

이 글에서 can가 뜻하는 바를 한국어 또는 쉬운 영어로 설명하세요.

근거 인용:

> When reading about this benefit, keep the word can in mind. A possible benefit is different from a promise about all gardens. The idea here is specific: growing plants in cities can provide habitats and help support biodiversity.

채점 초안: 1점: 가능/할 수 있다 또는 그럴 가능성이 있다는 뜻; 할 수 있다만 써도 인정. 0.5점: 미래에 그럴 예정이라고 하여 가능성과 의도가 섞인 경우. 0점: 반드시/언제나 그렇다는 보장으로 해석 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### S1 · syntax

Growing plants가 문장에서 맡는 역할과 beyond producing food의 뜻을 각각 설명하세요.
"Growing plants in a city can have a role beyond producing food."

근거 인용:

> Growing plants in a city can have a role beyond producing food.

채점 초안: 1점: 도시에서 식물을 기르는 일이 주어 + 식량 생산 외의 역할도 가능. 0.5점: 주어 또는 식량 생산 외라는 뜻 중 하나만 정확. 0점: 식량을 생산하지 못한다/언제나 같은 효과라는 의미로 바꿈 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### S2 · syntax

which means가 설명하는 말을 쓰고, 그 말의 설명을 적으세요.
"This is one possible function of urban agriculture, which means growing food in or near a city."

근거 인용:

> This is one possible function of urban agriculture, which means growing food in or near a city.

채점 초안: 1점: urban agriculture를 설명하며 도시 안/근처에서 먹거리를 기르는 것. 0.5점: 지시 대상 또는 설명 중 하나만 정확. 0점: biodiversity를 설명한다는 등 지시 대상이 틀리고 정의도 바뀜 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### S3 · syntax

does not show의 대상이 되는 that 절을 풀어 쓰고 부정의 범위를 설명하세요.
"Its scope matters: the review does not show that every garden in every part of the world produces the same result."

근거 인용:

> Its scope matters: the review does not show that every garden in every part of the world produces the same result.

채점 초안: 1점: 전 세계 모든 정원이 같은 결과를 만든다는 주장은 입증되지 않음. 0.5점: 전 세계 모든 정원이라는 범위 또는 입증되지 않음 중 하나만 정확. 0점: 어떤 정원도 도움이 안 됨/모든 정원이 같은 결과임으로 부정 범위를 바꿈 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

## F06-high1

본문 SHA256: 9551674d6a6ece12c3e5ece8f4fc8bd6dd5235b313a91e2b83e3a6fd9f03d017

A city garden may produce food, but food is not its only possible role. The garden can also offer habitats, or places for living things to stay. Birds and helpful insects are examples used to explain this role.

Providing such places can help support biodiversity, the variety of living things. The explanation connects a feature of a garden with a possible benefit. It does not say that all city gardens create the same amount of biodiversity.

The original research was a review focused on urban agriculture projects in the Global North. A review brings information from existing work together. Here, habitat provision was one of several functions considered. That research scope limits how widely we can apply its description.

Notice the difference between two claims. One says that urban gardens can provide habitats. The other says that every garden everywhere will improve biodiversity. The second claim is much broader and is not established by this review.

A careful reader can preserve the useful idea while keeping its limits. The garden's possible role and the scope of the research belong together. Removing those conditions would make the message stronger than the evidence given, even if the sentences became shorter and easier to read.

### R1 · reasoning

이 연구의 설명을 모든 지역의 모든 정원에 그대로 적용하려는 주장에 동의하나요? 이유도 쓰세요.

근거 인용:

> The original research was a review focused on urban agriculture projects in the Global North. A review brings information from existing work together. Here, habitat provision was one of several functions considered. That research scope limits how widely we can apply its description.

채점 초안: 1점: 동의하지 않음 + Global North를 다룬 검토/가능한 기능의 설명이 전 세계 동일 효과를 입증하지 않음. 0.5점: 반대만 쓰거나 연구 범위/가능성의 한계 근거만 정확. 0점: 어디서나 동일 효과가 보장된다고 주장 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### R2 · reasoning

요약에서 can을 will로 바꾸면 독자가 받아들이는 주장의 강도는 어떻게 달라지나요? 이 글의 근거와 연결해 설명하세요.

근거 인용:

> Notice the difference between two claims. One says that urban gardens can provide habitats. The other says that every garden everywhere will improve biodiversity. The second claim is much broader and is not established by this review.

채점 초안: 1점: 가능한 효과에서 보장/단정된 효과로 강해짐 + 연구는 그 보장을 뒷받침하지 않음. 0.5점: 강해진다는 변화 또는 근거가 보장을 지지하지 않음 중 하나만 정확. 0점: 아무 변화가 없거나 연구가 보장을 입증한다고 설명 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### R3 · reasoning

이 글의 핵심 설명 또는 연구 결과를 요약하는 결론 중 지지되는 결론 하나와 지지되지 않는 더 강한 결론 하나를 구별해 쓰세요.

근거 인용:

> Notice the difference between two claims. One says that urban gardens can provide habitats. The other says that every garden everywhere will improve biodiversity. The second claim is much broader and is not established by this review.

채점 초안: 1점: 본문이 지지하는 주요 설명/결과와 그것을 부당하게 강화한 결론을 정확히 구별. 예시: 도시 정원이 서식지/다양성을 지원할 수 있음 + 모든 정원이 어디서나 같은 다양성 효과를 낸다는 결론은 지지되지 않음. 예시는 유일한 정답이 아니다. 범위·인과·확실성 중 다른 측면을 강화한 타당한 결론 쌍도 인정하며 예시의 모든 한계를 나열할 필요는 없다. 0.5점: 지지/비지지 중 하나만 정확히 구별. 0점: 보편적 보장만을 연구 결론으로 제시 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### C1 · comprehension

글에서 정원이 서식 장소를 제공할 수 있는 생물의 예 두 가지를 쓰세요.

근거 인용:

> Birds and helpful insects are examples used to explain this role.

채점 초안: 1점: 새 + 유익한 곤충. 0.5점: 두 예 중 하나만 정확. 0점: 식량/사람 등 글에 제시되지 않은 예만 제시 또는 관련 없는 답. 판정 우선순위: 요청한 단위 중 일부는 맞고 나머지가 틀리거나 빠진 혼합 답은 0.5점이다. 아래 0점 예시에 해당하는 오류가 섞여도 정확한 요구 단위가 하나 이상 있으면 0.5점이며, 0점은 맞은 요구 단위가 전혀 없는 경우이다. 같은 단위에 서로 모순되는 답을 함께 쓰면 그 단위는 정답으로 인정하지 않는다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### C2 · comprehension

원래 연구의 종류와 다룬 지역을 글에서 찾아 쓰세요.

근거 인용:

> The original research was a review focused on urban agriculture projects in the Global North. A review brings information from existing work together.

채점 초안: 1점: 기존 자료를 검토한 review + Global North. 0.5점: 연구 종류 또는 지역 중 하나만 정확. 0점: 전 세계 모든 정원을 대상으로 한 새 실험이라고 해석 또는 관련 없는 답. 판정 우선순위: 요청한 단위 중 일부는 맞고 나머지가 틀리거나 빠진 혼합 답은 0.5점이다. 아래 0점 예시에 해당하는 오류가 섞여도 정확한 요구 단위가 하나 이상 있으면 0.5점이며, 0점은 맞은 요구 단위가 전혀 없는 경우이다. 같은 단위에 서로 모순되는 답을 함께 쓰면 그 단위는 정답으로 인정하지 않는다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### C3 · comprehension

도시 농업의 역할로 글에서 제시한 두 가지를 쓰세요.

근거 인용:

> A city garden may produce food, but food is not its only possible role. The garden can also offer habitats, or places for living things to stay. Birds and helpful insects are examples used to explain this role.

채점 초안: 1점: 먹거리/식물 생산 + 생물 서식지 제공/다양성 지원. 0.5점: 두 역할 중 하나만 정확. 0점: 글에 없는 효과만 나열 또는 관련 없는 답. 판정 우선순위: 요청한 단위 중 일부는 맞고 나머지가 틀리거나 빠진 혼합 답은 0.5점이다. 아래 0점 예시에 해당하는 오류가 섞여도 정확한 요구 단위가 하나 이상 있으면 0.5점이며, 0점은 맞은 요구 단위가 전혀 없는 경우이다. 같은 단위에 서로 모순되는 답을 함께 쓰면 그 단위는 정답으로 인정하지 않는다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### L1 · lexical

이 글에서 habitats가 뜻하는 바를 한국어 또는 쉬운 영어로 설명하세요.

근거 인용:

> The garden can also offer habitats, or places for living things to stay. Birds and helpful insects are examples used to explain this role.

채점 초안: 1점: 생물이 살거나 머무는 장소/서식지. 0.5점: 장소라고만 하여 생물과의 관련이 빠진 경우. 0점: 먹이/생물의 종류 등 장소와 다른 뜻 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### L2 · lexical

이 글에서 biodiversity가 뜻하는 바를 한국어 또는 쉬운 영어로 설명하세요.

근거 인용:

> Providing such places can help support biodiversity, the variety of living things.

채점 초안: 1점: 생물의 다양한 종류 또는 생물 다양성. 0.5점: 생물이 많다라고만 쓰고 종류의 다양성을 밝히지 않은 경우. 0점: 도시의 수/식량 생산량 등 다른 뜻 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### L3 · lexical

이 글에서 can가 뜻하는 바를 한국어 또는 쉬운 영어로 설명하세요.

근거 인용:

> Notice the difference between two claims. One says that urban gardens can provide habitats. The other says that every garden everywhere will improve biodiversity. The second claim is much broader and is not established by this review.

채점 초안: 1점: 가능/할 수 있다 또는 그럴 가능성이 있다는 뜻; 할 수 있다만 써도 인정. 0.5점: 미래에 그럴 예정이라고 하여 가능성과 의도가 섞인 경우. 0점: 반드시/언제나 그렇다는 보장으로 해석 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### S1 · syntax

but 앞뒤의 내용을 쓰고 not its only가 두 내용을 어떻게 연결하는지 설명하세요.
"A city garden may produce food, but food is not its only possible role."

근거 인용:

> A city garden may produce food, but food is not its only possible role.

채점 초안: 1점: 식량을 생산할 수 있지만 식량 생산만이 가능한 역할은 아님. 0.5점: 식량 생산 또는 다른 역할 가능 중 하나만 정확. 0점: 식량 생산을 부정하거나 식량만 생산한다고 반대로 해석 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### S2 · syntax

focused on이 설명하는 대상을 쓰고 그 연구가 다룬 범위를 설명하세요.
"The original research was a review focused on urban agriculture projects in the Global North."

근거 인용:

> The original research was a review focused on urban agriculture projects in the Global North.

채점 초안: 1점: review를 꾸미며 Global North의 도시 농업 프로젝트에 초점을 둠. 0.5점: review 또는 연구 대상/지역 중 일부만 정확. 0점: 전 세계 모든 정원의 실험이라는 등 대상/범위를 바꿈 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### S3 · syntax

would와 even if가 만드는 관계를 설명하세요. 조건을 없앤 경우와 문장이 쉬워진 경우를 함께 다루세요.
"Removing those conditions would make the message stronger than the evidence given, even if the sentences became shorter and easier to read."

근거 인용:

> Removing those conditions would make the message stronger than the evidence given, even if the sentences became shorter and easier to read.

채점 초안: 1점: 조건을 없애면 메시지가 증거보다 강해질 수 있으며 문장이 짧고 쉬워져도 그 문제는 남음. 0.5점: 조건 삭제의 결과 또는 양보 관계 중 하나만 정확. 0점: 쉬워지면 증거가 강해진다/조건을 없애도 의미는 그대로라는 등 관계를 바꿈 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

## F14-middle1

본문 SHA256: 5ed6fe7d58af3c672c841371f64822f8d915c0baa15a7854c365707d3c553519

When a family member or friend becomes very ill, researchers may ask how other people are feeling. One study examined COVID-19 and symptoms of depression and anxiety among people with a close person who had the illness. It used information from five study groups in four European countries.

The researchers compared groups using survey answers. The link with severe symptoms was stronger when the close person had been hospitalized or treated in an intensive care unit, called an ICU. An ICU gives care to people who are very seriously ill. The association was especially strong for the ICU group.

These results describe a pattern among groups. They do not mean that every individual became more anxious over time. They also concern reported symptoms. A survey result about symptoms is not the same thing as a doctor's diagnosis for each person.

The study observed people's experiences rather than assigning illness to anyone. It therefore cannot prove that a close person's illness alone caused the symptoms. Its results also come from a particular European setting. The key message combines a finding and a limit: more serious illness in a close person was linked with more severe symptoms, but the study does not establish a cause for every person.

### R1 · reasoning

가까운 사람의 병이 설문 응답자의 증상을 직접 일으켰다고 이 연구만으로 결론 내릴 수 있나요? 연구 방법을 근거로 답하세요.

근거 인용:

> The study observed people's experiences rather than assigning illness to anyone. It therefore cannot prove that a close person's illness alone caused the symptoms.

채점 초안: 1점: 아니오 + 경험을 관찰/설문한 집단 비교이며 원인을 입증하는 배정 실험이 아님. 0.5점: 아니오만 쓰거나 관찰 방법의 한계만 정확. 0점: 관찰된 연관만으로 직접 원인이 입증되었다고 주장 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### R2 · reasoning

설문에서 보고한 증상을 모든 응답자의 의사 진단으로 바꿔 요약해도 되나요? 어떤 정보가 달라지는지 설명하세요.

근거 인용:

> They also concern reported symptoms. A survey result about symptoms is not the same thing as a doctor's diagnosis for each person.

채점 초안: 1점: 안 됨 + 자기보고 증상 측정을 의사의 확정 진단으로 바꾸는 측정/증거의 변화. 0.5점: 안 됨만 쓰거나 증상과 진단의 차이만 정확. 0점: 설문이 모든 사람의 의사 진단과 같다고 주장 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### R3 · reasoning

이 글의 핵심 설명 또는 연구 결과를 요약하는 결론 중 지지되는 결론 하나와 지지되지 않는 더 강한 결론 하나를 구별해 쓰세요.

근거 인용:

> The study observed people's experiences rather than assigning illness to anyone. It therefore cannot prove that a close person's illness alone caused the symptoms. Its results also come from a particular European setting. The key message combines a finding and a limit: more serious illness in a close person was linked with more severe symptoms, but the study does not establish a cause for every person.

채점 초안: 1점: 본문이 지지하는 주요 설명/결과와 그것을 부당하게 강화한 결론을 정확히 구별. 예시: 유럽 연구 집단에서 가까운 사람의 중증 질환과 보고된 심한 증상이 연관 + 그 질환이 모든 개인의 증상을 직접 일으킨다는 결론은 지지되지 않음. 예시는 유일한 정답이 아니다. 범위·인과·확실성 중 다른 측면을 강화한 타당한 결론 쌍도 인정하며 예시의 모든 한계를 나열할 필요는 없다. 0.5점: 지지/비지지 중 하나만 정확히 구별; 국가 수·집단 수를 추가로 요구하지 않음. 0점: 집단의 연관을 모든 개인의 시간에 따른 증가/직접 원인으로 단정 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### C1 · comprehension

글에 나오는 연구 집단의 수와 국가의 수·지역을 쓰세요.

근거 인용:

> It used information from five study groups in four European countries.

채점 초안: 1점: 연구 집단 5개 + 유럽 4개국. 0.5점: 집단 수 또는 국가 수·지역 중 한 단위만 정확. 0점: 두 수를 바꾸거나 모두 틀림 또는 관련 없는 답. 판정 우선순위: 요청한 단위 중 일부는 맞고 나머지가 틀리거나 빠진 혼합 답은 0.5점이다. 아래 0점 예시에 해당하는 오류가 섞여도 정확한 요구 단위가 하나 이상 있으면 0.5점이며, 0점은 맞은 요구 단위가 전혀 없는 경우이다. 같은 단위에 서로 모순되는 답을 함께 쓰면 그 단위는 정답으로 인정하지 않는다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### C2 · comprehension

글에서 가까운 사람의 예로 든 두 관계를 쓰세요.

근거 인용:

> When a family member or friend becomes very ill, researchers may ask how other people are feeling. One study examined COVID-19 and symptoms of depression and anxiety among people with a close person who had the illness.

채점 초안: 1점: 가족 + 친구. 0.5점: 두 관계 중 하나만 정확. 0점: 의사/연구자 등 다른 관계만 제시 또는 관련 없는 답. 판정 우선순위: 요청한 단위 중 일부는 맞고 나머지가 틀리거나 빠진 혼합 답은 0.5점이다. 아래 0점 예시에 해당하는 오류가 섞여도 정확한 요구 단위가 하나 이상 있으면 0.5점이며, 0점은 맞은 요구 단위가 전혀 없는 경우이다. 같은 단위에 서로 모순되는 답을 함께 쓰면 그 단위는 정답으로 인정하지 않는다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### C3 · comprehension

증상 정보를 얻은 방식과, 특히 연관이 강했던 치료 집단을 쓰세요.

근거 인용:

> The researchers compared groups using survey answers. The link with severe symptoms was stronger when the close person had been hospitalized or treated in an intensive care unit, called an ICU. An ICU gives care to people who are very seriously ill. The association was especially strong for the ICU group.

채점 초안: 1점: 설문/자기보고 + ICU 치료 집단. 0.5점: 방식 또는 집단 중 하나만 정확; 예: 의사의 확정 진단과 ICU 집단이라고 쓴 답은 집단만 맞으므로 0.5점. 0점: 확정 진단/모든 개인을 임의 치료한 실험이라고 해석 또는 관련 없는 답. 판정 우선순위: 요청한 단위 중 일부는 맞고 나머지가 틀리거나 빠진 혼합 답은 0.5점이다. 아래 0점 예시에 해당하는 오류가 섞여도 정확한 요구 단위가 하나 이상 있으면 0.5점이며, 0점은 맞은 요구 단위가 전혀 없는 경우이다. 같은 단위에 서로 모순되는 답을 함께 쓰면 그 단위는 정답으로 인정하지 않는다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### L1 · lexical

이 글에서 symptoms가 뜻하는 바를 한국어 또는 쉬운 영어로 설명하세요.

근거 인용:

> One study examined COVID-19 and symptoms of depression and anxiety among people with a close person who had the illness.

채점 초안: 1점: 증상 또는 사람들이 느끼거나 보고한 우울·불안 관련 상태; 증상만 써도 인정. 0.5점: 우울/불안 한 예만 나열하고 증상이라는 뜻은 설명하지 않은 경우. 0점: 의사가 확정한 모든 사람의 진단이라고 해석 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### L2 · lexical

이 글에서 association가 뜻하는 바를 한국어 또는 쉬운 영어로 설명하세요.

근거 인용:

> The researchers compared groups using survey answers. The link with severe symptoms was stronger when the close person had been hospitalized or treated in an intensive care unit, called an ICU. An ICU gives care to people who are very seriously ill. The association was especially strong for the ICU group.

채점 초안: 1점: 연관/연관성/상관관계 또는 두 특성이 함께 관련되어 나타나는 관계; 연관성만 써도 인정. 0.5점: 모호한 관계라고만 하여 함께 관련되어 나타남이 불분명. 0점: 한 특성이 다른 특성을 반드시 일으킨다는 원인 관계 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### L3 · lexical

이 글에서 ICU가 뜻하는 바를 한국어 또는 쉬운 영어로 설명하세요.

근거 인용:

> The link with severe symptoms was stronger when the close person had been hospitalized or treated in an intensive care unit, called an ICU. An ICU gives care to people who are very seriously ill.

채점 초안: 1점: 중환자실 또는 매우 위중한 환자를 집중적으로 돌보는 곳; 중환자실만 써도 인정. 0.5점: 병원/치료실이라고만 쓰고 집중 치료나 위중함이 빠진 경우. 0점: 우울증 진단명/조사 집단의 국가명 등 다른 뜻 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### S1 · syntax

when 절의 상황과 how 절에서 연구자가 묻는 내용을 각각 설명하세요.
"When a family member or friend becomes very ill, researchers may ask how other people are feeling."

근거 인용:

> When a family member or friend becomes very ill, researchers may ask how other people are feeling.

채점 초안: 1점: 가족/친구가 매우 아픈 상황 + 다른 사람들이 어떻게 느끼는지 질문. 0.5점: 상황 또는 질문 내용 중 하나만 정확. 0점: 환자의 진단을 확정한다는 등 질문 대상/행위를 바꿈 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### S2 · syntax

when 절의 상황과 or로 연결된 두 경우를 쓰고, 그때 주절에서 비교하는 연관이 어떻게 달라지는지 설명하세요.
"The link with severe symptoms was stronger when the close person had been hospitalized or treated in an intensive care unit, called an ICU."

근거 인용:

> The link with severe symptoms was stronger when the close person had been hospitalized or treated in an intensive care unit, called an ICU.

채점 초안: 1점: 가까운 사람이 입원했거나 ICU 치료를 받았을 때 심한 증상과의 연관이 더 강함. 0.5점: 연관이 더 강하다는 내용과 입원/ICU 중 한 경우만 정확, 또는 두 경우는 맞지만 주절 비교가 빠짐. 0점: 모든 사람이 시간이 흐르며 더 아프다는 등 비교/시간/인과를 바꿈 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### S3 · syntax

do not mean that의 that 절을 풀어 쓰고 부정되는 내용을 설명하세요.
"They do not mean that every individual became more anxious over time."

근거 인용:

> They do not mean that every individual became more anxious over time.

채점 초안: 1점: 모든 개인이 시간에 따라 더 불안해졌다는 해석을 부정. 0.5점: 모든 개인/시간에 따른 증가 중 한 요소는 빠지지만 부정은 정확. 0점: 모든 개인이 더 불안해졌다고 긍정하거나 아무 증상도 없다고 해석 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

## F14-high1

본문 SHA256: eda36e55550ef297166f211d1c06964d4cdd315e3041b52563b5f533ffc326cf

Researchers studied the link between serious COVID-19 in a close person and reported symptoms of depression and anxiety. They brought together information from five study groups in four European countries. A close person could be a family member or friend.

The association with severe symptoms was stronger when that person had been hospitalized or treated in an ICU, an intensive care unit. The ICU group showed an especially strong association. This describes a comparison between groups, not a claim that each respondent's symptoms increased over time.

Two limits are important when interpreting the finding. First, the measures were survey reports of symptoms. They were not a doctor's diagnosis of every respondent. Second, the research observed experiences. It did not assign people to have a seriously ill relative or friend. A link in this kind of study does not by itself prove causation.

The setting matters as well. Results from these European study groups should not automatically be treated as a result for every population. A reader can accept the reported association while questioning a stronger claim about everyone. The safest summary keeps the group comparison, the symptom measures and the study's limits together. Dropping any of them could change what the result means.

### R1 · reasoning

가까운 사람의 병이 설문 응답자의 증상을 직접 일으켰다고 이 연구만으로 결론 내릴 수 있나요? 연구 방법을 근거로 답하세요.

근거 인용:

> Second, the research observed experiences. It did not assign people to have a seriously ill relative or friend. A link in this kind of study does not by itself prove causation.

채점 초안: 1점: 아니오 + 경험을 관찰/설문한 집단 비교이며 원인을 입증하는 배정 실험이 아님. 0.5점: 아니오만 쓰거나 관찰 방법의 한계만 정확. 0점: 관찰된 연관만으로 직접 원인이 입증되었다고 주장 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### R2 · reasoning

설문에서 보고한 증상을 모든 응답자의 의사 진단으로 바꿔 요약해도 되나요? 어떤 정보가 달라지는지 설명하세요.

근거 인용:

> Two limits are important when interpreting the finding. First, the measures were survey reports of symptoms. They were not a doctor's diagnosis of every respondent.

채점 초안: 1점: 안 됨 + 자기보고 증상 측정을 의사의 확정 진단으로 바꾸는 측정/증거의 변화. 0.5점: 안 됨만 쓰거나 증상과 진단의 차이만 정확. 0점: 설문이 모든 사람의 의사 진단과 같다고 주장 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### R3 · reasoning

이 글의 핵심 설명 또는 연구 결과를 요약하는 결론 중 지지되는 결론 하나와 지지되지 않는 더 강한 결론 하나를 구별해 쓰세요.

근거 인용:

> The setting matters as well. Results from these European study groups should not automatically be treated as a result for every population. A reader can accept the reported association while questioning a stronger claim about everyone. The safest summary keeps the group comparison, the symptom measures and the study's limits together. Dropping any of them could change what the result means.

채점 초안: 1점: 본문이 지지하는 주요 설명/결과와 그것을 부당하게 강화한 결론을 정확히 구별. 예시: 유럽 연구 집단에서 가까운 사람의 중증 질환과 보고된 심한 증상이 연관 + 그 질환이 모든 개인의 증상을 직접 일으킨다는 결론은 지지되지 않음. 예시는 유일한 정답이 아니다. 범위·인과·확실성 중 다른 측면을 강화한 타당한 결론 쌍도 인정하며 예시의 모든 한계를 나열할 필요는 없다. 0.5점: 지지/비지지 중 하나만 정확히 구별; 국가 수·집단 수를 추가로 요구하지 않음. 0점: 집단의 연관을 모든 개인의 시간에 따른 증가/직접 원인으로 단정 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### C1 · comprehension

글에 나오는 연구 집단의 수와 국가의 수·지역을 쓰세요.

근거 인용:

> They brought together information from five study groups in four European countries.

채점 초안: 1점: 연구 집단 5개 + 유럽 4개국. 0.5점: 집단 수 또는 국가 수·지역 중 한 단위만 정확. 0점: 두 수를 바꾸거나 모두 틀림 또는 관련 없는 답. 판정 우선순위: 요청한 단위 중 일부는 맞고 나머지가 틀리거나 빠진 혼합 답은 0.5점이다. 아래 0점 예시에 해당하는 오류가 섞여도 정확한 요구 단위가 하나 이상 있으면 0.5점이며, 0점은 맞은 요구 단위가 전혀 없는 경우이다. 같은 단위에 서로 모순되는 답을 함께 쓰면 그 단위는 정답으로 인정하지 않는다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### C2 · comprehension

글에서 가까운 사람의 예로 든 두 관계를 쓰세요.

근거 인용:

> A close person could be a family member or friend.

채점 초안: 1점: 가족 + 친구. 0.5점: 두 관계 중 하나만 정확. 0점: 의사/연구자 등 다른 관계만 제시 또는 관련 없는 답. 판정 우선순위: 요청한 단위 중 일부는 맞고 나머지가 틀리거나 빠진 혼합 답은 0.5점이다. 아래 0점 예시에 해당하는 오류가 섞여도 정확한 요구 단위가 하나 이상 있으면 0.5점이며, 0점은 맞은 요구 단위가 전혀 없는 경우이다. 같은 단위에 서로 모순되는 답을 함께 쓰면 그 단위는 정답으로 인정하지 않는다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### C3 · comprehension

증상 정보를 얻은 방식과, 특히 연관이 강했던 치료 집단을 쓰세요.

근거 인용:

> The association with severe symptoms was stronger when that person had been hospitalized or treated in an ICU, an intensive care unit. The ICU group showed an especially strong association. This describes a comparison between groups, not a claim that each respondent's symptoms increased over time.
>
> Two limits are important when interpreting the finding. First, the measures were survey reports of symptoms.

채점 초안: 1점: 설문/자기보고 + ICU 치료 집단. 0.5점: 방식 또는 집단 중 하나만 정확; 예: 의사의 확정 진단과 ICU 집단이라고 쓴 답은 집단만 맞으므로 0.5점. 0점: 확정 진단/모든 개인을 임의 치료한 실험이라고 해석 또는 관련 없는 답. 판정 우선순위: 요청한 단위 중 일부는 맞고 나머지가 틀리거나 빠진 혼합 답은 0.5점이다. 아래 0점 예시에 해당하는 오류가 섞여도 정확한 요구 단위가 하나 이상 있으면 0.5점이며, 0점은 맞은 요구 단위가 전혀 없는 경우이다. 같은 단위에 서로 모순되는 답을 함께 쓰면 그 단위는 정답으로 인정하지 않는다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### L1 · lexical

이 글에서 symptoms가 뜻하는 바를 한국어 또는 쉬운 영어로 설명하세요.

근거 인용:

> Researchers studied the link between serious COVID-19 in a close person and reported symptoms of depression and anxiety.

채점 초안: 1점: 증상 또는 사람들이 느끼거나 보고한 우울·불안 관련 상태; 증상만 써도 인정. 0.5점: 우울/불안 한 예만 나열하고 증상이라는 뜻은 설명하지 않은 경우. 0점: 의사가 확정한 모든 사람의 진단이라고 해석 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### L2 · lexical

이 글에서 association가 뜻하는 바를 한국어 또는 쉬운 영어로 설명하세요.

근거 인용:

> The association with severe symptoms was stronger when that person had been hospitalized or treated in an ICU, an intensive care unit. The ICU group showed an especially strong association. This describes a comparison between groups, not a claim that each respondent's symptoms increased over time.

채점 초안: 1점: 연관/연관성/상관관계 또는 두 특성이 함께 관련되어 나타나는 관계; 연관성만 써도 인정. 0.5점: 모호한 관계라고만 하여 함께 관련되어 나타남이 불분명. 0점: 한 특성이 다른 특성을 반드시 일으킨다는 원인 관계 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### L3 · lexical

이 글에서 ICU가 뜻하는 바를 한국어 또는 쉬운 영어로 설명하세요.

근거 인용:

> The association with severe symptoms was stronger when that person had been hospitalized or treated in an ICU, an intensive care unit. The ICU group showed an especially strong association.

채점 초안: 1점: 중환자실 또는 매우 위중한 환자를 집중적으로 돌보는 곳; 중환자실만 써도 인정. 0.5점: 병원/치료실이라고만 쓰고 집중 치료나 위중함이 빠진 경우. 0점: 우울증 진단명/조사 집단의 국가명 등 다른 뜻 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### S1 · syntax

between A and B에서 A와 B를 각각 쓰고 두 대상을 누가 조사했는지 설명하세요.
"Researchers studied the link between serious COVID-19 in a close person and reported symptoms of depression and anxiety."

근거 인용:

> Researchers studied the link between serious COVID-19 in a close person and reported symptoms of depression and anxiety.

채점 초안: 1점: 연구자가 가까운 사람의 중증 COVID-19와 보고된 우울/불안 증상의 연관을 조사. 0.5점: 조사 주체와 두 대상 중 하나만 정확. 0점: 환자 본인의 확정 진단을 조사했다는 등 대상/측정을 바꿈 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### S2 · syntax

They의 지시 대상을 쓰고 not이 부정하는 내용을 설명하세요.
"First, the measures were survey reports of symptoms. They were not a doctor's diagnosis of every respondent."

근거 인용:

> First, the measures were survey reports of symptoms. They were not a doctor's diagnosis of every respondent.

채점 초안: 1점: 증상 설문 측정을 가리키며 모든 응답자의 의사 진단이 아님. 0.5점: 지시 대상 또는 진단이 아님 중 하나만 정확. 0점: 설문이 모든 사람의 진단이라고 해석/증상이 전혀 없다고 해석 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### S3 · syntax

them이 가리키는 세 요소를 쓰고 could가 있는 문장의 뜻을 설명하세요.
"The safest summary keeps the group comparison, the symptom measures and the study's limits together. Dropping any of them could change what the result means."

근거 인용:

> The safest summary keeps the group comparison, the symptom measures and the study's limits together. Dropping any of them could change what the result means.

채점 초안: 1점: 집단 비교·증상 측정·연구 한계 중 어떤 것을 빼도 결과의 의미가 바뀔 수 있음. 0.5점: 세 요소 중 둘과 삭제 시 의미 변화 가능을 정확히 설명, 또는 세 요소는 맞지만 가능성 설명이 빠짐. 0점: 어떤 요소를 빼도 의미가 유지된다고 반대로 설명 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

## F18-middle1

본문 SHA256: ec2ae815dd2b7e0aaf6b0b58de4cda3ecb802772eb939992a8dd7b063a347f1f

Researchers compared fighting behavior in female fruit flies from eight species. One question concerned ovarioles. These are parts of the female reproductive system where eggs are produced. Different species have different average numbers of these structures.

The researchers found a positive association between ovariole number and one kind of fighting behavior, headbutting. In the species comparison, flies from species with more ovarioles tended to spend a greater share of the observed time headbutting. This was a pattern across species, not a rule about every individual fly.

A positive association means that two features tend to vary together. It does not tell us, by itself, why they vary together. The comparison did not show that having more ovarioles causes a female to fight. A possible explanation and a demonstrated cause are different things.

This distinction helps us read the result carefully. We can describe the pattern without turning it into a certain prediction for all flies. We should also remember that the comparison concerned the eight species studied. The important idea is both simple and limited: ovariole number and headbutting were positively related across those species, but the evidence does not establish that one feature directly caused the other.

### R1 · reasoning

ovariole 수가 싸움의 직접 원인이라는 설명을 이 연구만으로 확정할 수 있나요? 관찰된 관계를 근거로 답하세요.

근거 인용:

> A positive association means that two features tend to vary together. It does not tell us, by itself, why they vary together. The comparison did not show that having more ovarioles causes a female to fight. A possible explanation and a demonstrated cause are different things.

채점 초안: 1점: 아니오 + 종 사이에서 함께 변한 연관만으로 직접 원인이 입증되지는 않음. 0.5점: 아니오만 쓰거나 연관과 원인의 차이만 정확. 0점: 양의 연관이 직접 원인을 입증한다고 주장 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### R2 · reasoning

종 평균 사이의 패턴으로 다음에 관찰할 개별 초파리의 행동을 반드시 맞힐 수 있나요? 비교 단위를 근거로 답하세요.

근거 인용:

> In the species comparison, flies from species with more ovarioles tended to spend a greater share of the observed time headbutting. This was a pattern across species, not a rule about every individual fly.

채점 초안: 1점: 아니오 + 종 평균의 패턴은 모든 개체의 행동 규칙/확정 예측이 아님. 0.5점: 아니오만 쓰거나 종/개체 비교 단위의 차이만 정확. 0점: 종 평균이 모든 개체의 행동을 보장한다고 주장 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### R3 · reasoning

이 글의 핵심 설명 또는 연구 결과를 요약하는 결론 중 지지되는 결론 하나와 지지되지 않는 더 강한 결론 하나를 구별해 쓰세요.

근거 인용:

> This distinction helps us read the result carefully. We can describe the pattern without turning it into a certain prediction for all flies. We should also remember that the comparison concerned the eight species studied. The important idea is both simple and limited: ovariole number and headbutting were positively related across those species, but the evidence does not establish that one feature directly caused the other.

채점 초안: 1점: 본문이 지지하는 주요 설명/결과와 그것을 부당하게 강화한 결론을 정확히 구별. 예시: 비교한 8종에서 ovariole 수와 headbutting 시간 비율이 양의 연관 + 더 많은 ovarioles가 모든 개체를 싸우게 한다는 결론은 지지되지 않음. 예시는 유일한 정답이 아니다. 범위·인과·확실성 중 다른 측면을 강화한 타당한 결론 쌍도 인정하며 예시의 모든 한계를 나열할 필요는 없다. 0.5점: 지지/비지지 중 하나만 정확히 구별; 종 수를 빠뜨려도 종 수준·양의 방향을 보존하면 지지 결론 인정. 0점: 관계가 전혀 없다고 하거나 직접 원인이 입증되었다고 단정 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### C1 · comprehension

연구가 비교한 초파리의 성별과 종의 수를 쓰세요.

근거 인용:

> Researchers compared fighting behavior in female fruit flies from eight species.

채점 초안: 1점: 암컷 + 8종. 0.5점: 성별 또는 종 수 중 하나만 정확. 0점: 수컷 8개체 등 두 단위 모두 틀림 또는 관련 없는 답. 판정 우선순위: 요청한 단위 중 일부는 맞고 나머지가 틀리거나 빠진 혼합 답은 0.5점이다. 아래 0점 예시에 해당하는 오류가 섞여도 정확한 요구 단위가 하나 이상 있으면 0.5점이며, 0점은 맞은 요구 단위가 전혀 없는 경우이다. 같은 단위에 서로 모순되는 답을 함께 쓰면 그 단위는 정답으로 인정하지 않는다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### C2 · comprehension

글에서 ovariole 수와 관련된 행동의 이름과, 그 행동을 기록한 시간 지표를 쓰세요.

근거 인용:

> The researchers found a positive association between ovariole number and one kind of fighting behavior, headbutting. In the species comparison, flies from species with more ovarioles tended to spend a greater share of the observed time headbutting. This was a pattern across species, not a rule about every individual fly.

채점 초안: 1점: headbutting(머리로 들이받기) + 관찰 시간 중 그 행동에 쓴 비율. 0.5점: 행동 또는 시간 비율 중 하나만 정확; 예: headbutting의 횟수라고 쓴 답은 행동만 맞으므로 0.5점. 0점: 행동 횟수/모든 개체의 미래 싸움 시간 등 다른 지표 또는 관련 없는 답. 판정 우선순위: 요청한 단위 중 일부는 맞고 나머지가 틀리거나 빠진 혼합 답은 0.5점이다. 아래 0점 예시에 해당하는 오류가 섞여도 정확한 요구 단위가 하나 이상 있으면 0.5점이며, 0점은 맞은 요구 단위가 전혀 없는 경우이다. 같은 단위에 서로 모순되는 답을 함께 쓰면 그 단위는 정답으로 인정하지 않는다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### C3 · comprehension

ovarioles가 하는 기능과 연구자가 비교한 생물학적 수준을 쓰세요.

근거 인용:

> These are parts of the female reproductive system where eggs are produced. Different species have different average numbers of these structures.

채점 초안: 1점: 알 생산 + 종 또는 종 평균 사이의 비교. 0.5점: 기능 또는 비교 수준 중 하나만 정확. 0점: 알 자체의 개수/모든 개별 개체에 대한 확정 규칙이라고 해석 또는 관련 없는 답. 판정 우선순위: 요청한 단위 중 일부는 맞고 나머지가 틀리거나 빠진 혼합 답은 0.5점이다. 아래 0점 예시에 해당하는 오류가 섞여도 정확한 요구 단위가 하나 이상 있으면 0.5점이며, 0점은 맞은 요구 단위가 전혀 없는 경우이다. 같은 단위에 서로 모순되는 답을 함께 쓰면 그 단위는 정답으로 인정하지 않는다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### L1 · lexical

이 글에서 ovarioles가 뜻하는 바를 한국어 또는 쉬운 영어로 설명하세요.

근거 인용:

> One question concerned ovarioles. These are parts of the female reproductive system where eggs are produced. Different species have different average numbers of these structures.

채점 초안: 1점: 알이 만들어지는 암컷 생식 기관의 구조/난소소관. 0.5점: 생식 기관/알 관련 구조라고만 쓰고 알이 만들어진다는 기능이 빠진 경우. 0점: 알 자체/싸움 행동 등 다른 대상 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### L2 · lexical

이 글에서 positive association가 뜻하는 바를 한국어 또는 쉬운 영어로 설명하세요.

근거 인용:

> A positive association means that two features tend to vary together. It does not tell us, by itself, why they vary together.

채점 초안: 1점: 한 특성이 큰 종에서 다른 특성도 큰 경향을 보이는 같은 방향의 연관. 0.5점: 서로 관련된다라고만 쓰고 같은 방향의 경향을 밝히지 않은 경우. 0점: 좋은 관계라는 가치 판단/한 특성이 반드시 다른 특성을 일으킨다는 뜻 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### L3 · lexical

이 글에서 species가 뜻하는 바를 한국어 또는 쉬운 영어로 설명하세요.

근거 인용:

> Researchers compared fighting behavior in female fruit flies from eight species.

채점 초안: 1점: 비교한 초파리의 종/생물의 종류. 0.5점: 집단이라고만 쓰고 생물의 종류임이 불분명. 0점: 개체 한 마리/생식 기관의 수 등 다른 단위 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### S1 · syntax

with more ovarioles가 꾸미는 대상을 쓰고 tended to 뒤의 경향을 설명하세요.
"In the species comparison, flies from species with more ovarioles tended to spend a greater share of the observed time headbutting."

근거 인용:

> In the species comparison, flies from species with more ovarioles tended to spend a greater share of the observed time headbutting.

채점 초안: 1점: ovarioles가 더 많은 종 + 관찰 시간 중 headbutting에 쓰는 비율이 더 큰 경향. 0.5점: 종의 꾸밈 또는 시간 비율 증가 경향 중 하나만 정확. 0점: 모든 개체의 싸움 횟수를 확정하거나 비율을 반대로 해석 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### S2 · syntax

not이 대조하는 두 단위를 각각 쓰고 문장의 뜻을 설명하세요.
"This was a pattern across species, not a rule about every individual fly."

근거 인용:

> This was a pattern across species, not a rule about every individual fly.

채점 초안: 1점: 종 사이의 패턴이며 모든 개별 초파리에 적용되는 규칙은 아님. 0.5점: 종 수준 또는 모든 개체 규칙이 아님 중 하나만 정확. 0점: 모든 개체의 행동 규칙이라고 해석 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### S3 · syntax

that 절의 내용을 쓰고 did not show가 부정하는 내용을 설명하세요.
"The comparison did not show that having more ovarioles causes a female to fight."

근거 인용:

> The comparison did not show that having more ovarioles causes a female to fight.

채점 초안: 1점: ovarioles 증가가 암컷의 싸움을 일으킨다는 인과를 비교가 입증하지 않음. 0.5점: 인과 내용 또는 입증되지 않음 중 하나만 정확. 0점: 직접 인과가 입증되었다/관련이 전혀 없다고 해석 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

## F18-high1

본문 SHA256: 1b4f0424725821bc464e2ed68e5853dfc744a1c8f8f9ade74f171644511a6d66

A study of female fruit flies compared eight species. It examined whether ovariole number was related to fighting behavior. Ovarioles are structures where eggs are produced. The researchers considered average features of species rather than treating every individual as the same.

They found a positive association between ovariole number and headbutting. Species with more ovarioles tended to show a greater share of observed time in that behavior. This finding describes two features varying together across the studied species.

Now consider a stronger explanation: more ovarioles make a fly fight. The observed association does not establish that explanation. A comparison can show a pattern without showing what causes it. Nor does a pattern in species averages tell us exactly how every individual will behave.

The structure of the argument is therefore important. The study question leads to a comparison, the comparison reveals an association, and the association leaves a question about cause. Keeping these steps separate prevents an easy but unsupported leap.

A careful summary should preserve both the positive direction of the association and its limits. Calling the result uncertain in every respect would lose the observed pattern. Calling it proof of a direct cause would go beyond the evidence. The reader needs both parts to understand the finding.

### R1 · reasoning

ovariole 수가 싸움의 직접 원인이라는 설명을 이 연구만으로 확정할 수 있나요? 관찰된 관계를 근거로 답하세요.

근거 인용:

> Now consider a stronger explanation: more ovarioles make a fly fight. The observed association does not establish that explanation. A comparison can show a pattern without showing what causes it. Nor does a pattern in species averages tell us exactly how every individual will behave.

채점 초안: 1점: 아니오 + 종 사이에서 함께 변한 연관만으로 직접 원인이 입증되지는 않음. 0.5점: 아니오만 쓰거나 연관과 원인의 차이만 정확. 0점: 양의 연관이 직접 원인을 입증한다고 주장 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### R2 · reasoning

종 평균 사이의 패턴으로 다음에 관찰할 개별 초파리의 행동을 반드시 맞힐 수 있나요? 비교 단위를 근거로 답하세요.

근거 인용:

> The researchers considered average features of species rather than treating every individual as the same.

채점 초안: 1점: 아니오 + 종 평균의 패턴은 모든 개체의 행동 규칙/확정 예측이 아님. 0.5점: 아니오만 쓰거나 종/개체 비교 단위의 차이만 정확. 0점: 종 평균이 모든 개체의 행동을 보장한다고 주장 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### R3 · reasoning

이 글의 핵심 설명 또는 연구 결과를 요약하는 결론 중 지지되는 결론 하나와 지지되지 않는 더 강한 결론 하나를 구별해 쓰세요.

근거 인용:

> A careful summary should preserve both the positive direction of the association and its limits. Calling the result uncertain in every respect would lose the observed pattern. Calling it proof of a direct cause would go beyond the evidence. The reader needs both parts to understand the finding.

채점 초안: 1점: 본문이 지지하는 주요 설명/결과와 그것을 부당하게 강화한 결론을 정확히 구별. 예시: 비교한 8종에서 ovariole 수와 headbutting 시간 비율이 양의 연관 + 더 많은 ovarioles가 모든 개체를 싸우게 한다는 결론은 지지되지 않음. 예시는 유일한 정답이 아니다. 범위·인과·확실성 중 다른 측면을 강화한 타당한 결론 쌍도 인정하며 예시의 모든 한계를 나열할 필요는 없다. 0.5점: 지지/비지지 중 하나만 정확히 구별; 종 수를 빠뜨려도 종 수준·양의 방향을 보존하면 지지 결론 인정. 0점: 관계가 전혀 없다고 하거나 직접 원인이 입증되었다고 단정 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### C1 · comprehension

연구가 비교한 초파리의 성별과 종의 수를 쓰세요.

근거 인용:

> A study of female fruit flies compared eight species.

채점 초안: 1점: 암컷 + 8종. 0.5점: 성별 또는 종 수 중 하나만 정확. 0점: 수컷 8개체 등 두 단위 모두 틀림 또는 관련 없는 답. 판정 우선순위: 요청한 단위 중 일부는 맞고 나머지가 틀리거나 빠진 혼합 답은 0.5점이다. 아래 0점 예시에 해당하는 오류가 섞여도 정확한 요구 단위가 하나 이상 있으면 0.5점이며, 0점은 맞은 요구 단위가 전혀 없는 경우이다. 같은 단위에 서로 모순되는 답을 함께 쓰면 그 단위는 정답으로 인정하지 않는다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### C2 · comprehension

글에서 ovariole 수와 관련된 행동의 이름과, 그 행동을 기록한 시간 지표를 쓰세요.

근거 인용:

> They found a positive association between ovariole number and headbutting. Species with more ovarioles tended to show a greater share of observed time in that behavior. This finding describes two features varying together across the studied species.

채점 초안: 1점: headbutting(머리로 들이받기) + 관찰 시간 중 그 행동에 쓴 비율. 0.5점: 행동 또는 시간 비율 중 하나만 정확; 예: headbutting의 횟수라고 쓴 답은 행동만 맞으므로 0.5점. 0점: 행동 횟수/모든 개체의 미래 싸움 시간 등 다른 지표 또는 관련 없는 답. 판정 우선순위: 요청한 단위 중 일부는 맞고 나머지가 틀리거나 빠진 혼합 답은 0.5점이다. 아래 0점 예시에 해당하는 오류가 섞여도 정확한 요구 단위가 하나 이상 있으면 0.5점이며, 0점은 맞은 요구 단위가 전혀 없는 경우이다. 같은 단위에 서로 모순되는 답을 함께 쓰면 그 단위는 정답으로 인정하지 않는다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### C3 · comprehension

ovarioles가 하는 기능과 연구자가 비교한 생물학적 수준을 쓰세요.

근거 인용:

> Ovarioles are structures where eggs are produced. The researchers considered average features of species rather than treating every individual as the same.

채점 초안: 1점: 알 생산 + 종 또는 종 평균 사이의 비교. 0.5점: 기능 또는 비교 수준 중 하나만 정확. 0점: 알 자체의 개수/모든 개별 개체에 대한 확정 규칙이라고 해석 또는 관련 없는 답. 판정 우선순위: 요청한 단위 중 일부는 맞고 나머지가 틀리거나 빠진 혼합 답은 0.5점이다. 아래 0점 예시에 해당하는 오류가 섞여도 정확한 요구 단위가 하나 이상 있으면 0.5점이며, 0점은 맞은 요구 단위가 전혀 없는 경우이다. 같은 단위에 서로 모순되는 답을 함께 쓰면 그 단위는 정답으로 인정하지 않는다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### L1 · lexical

이 글에서 ovarioles가 뜻하는 바를 한국어 또는 쉬운 영어로 설명하세요.

근거 인용:

> It examined whether ovariole number was related to fighting behavior. Ovarioles are structures where eggs are produced. The researchers considered average features of species rather than treating every individual as the same.

채점 초안: 1점: 알이 만들어지는 암컷 생식 기관의 구조/난소소관. 0.5점: 생식 기관/알 관련 구조라고만 쓰고 알이 만들어진다는 기능이 빠진 경우. 0점: 알 자체/싸움 행동 등 다른 대상 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### L2 · lexical

이 글에서 positive association가 뜻하는 바를 한국어 또는 쉬운 영어로 설명하세요.

근거 인용:

> They found a positive association between ovariole number and headbutting. Species with more ovarioles tended to show a greater share of observed time in that behavior. This finding describes two features varying together across the studied species.

채점 초안: 1점: 한 특성이 큰 종에서 다른 특성도 큰 경향을 보이는 같은 방향의 연관. 0.5점: 서로 관련된다라고만 쓰고 같은 방향의 경향을 밝히지 않은 경우. 0점: 좋은 관계라는 가치 판단/한 특성이 반드시 다른 특성을 일으킨다는 뜻 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### L3 · lexical

이 글에서 species가 뜻하는 바를 한국어 또는 쉬운 영어로 설명하세요.

근거 인용:

> A study of female fruit flies compared eight species. It examined whether ovariole number was related to fighting behavior. Ovarioles are structures where eggs are produced. The researchers considered average features of species rather than treating every individual as the same.

채점 초안: 1점: 비교한 초파리의 종/생물의 종류. 0.5점: 집단이라고만 쓰고 생물의 종류임이 불분명. 0점: 개체 한 마리/생식 기관의 수 등 다른 단위 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### S1 · syntax

rather than 앞뒤의 두 접근을 각각 쓰고 연구자가 택한 쪽을 설명하세요.
"The researchers considered average features of species rather than treating every individual as the same."

근거 인용:

> The researchers considered average features of species rather than treating every individual as the same.

채점 초안: 1점: 종의 평균 특성을 살피며 모든 개체를 동일하게 취급하는 접근을 택하지 않음. 0.5점: 두 접근 중 하나와 선택 방향만 정확. 0점: 모든 개체를 똑같이 취급하는 쪽을 택했다고 해석 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### S2 · syntax

without showing이 제한하는 내용과 can show가 허용하는 내용을 각각 설명하세요.
"A comparison can show a pattern without showing what causes it."

근거 인용:

> A comparison can show a pattern without showing what causes it.

채점 초안: 1점: 비교가 패턴을 보여줄 수 있어도 그 원인까지 보여주는 것은 아님. 0.5점: 패턴 가능 또는 원인 입증 제한 중 하나만 정확. 0점: 패턴이 곧 원인을 입증한다/어떤 패턴도 알 수 없다고 해석 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.

### S3 · syntax

Nor와 every individual이 포함된 문장을 풀어 쓰세요. 정확히 알 수 없다는 내용의 범위도 설명하세요.
"Nor does a pattern in species averages tell us exactly how every individual will behave."

근거 인용:

> Nor does a pattern in species averages tell us exactly how every individual will behave.

채점 초안: 1점: 종 평균의 패턴은 모든 개체의 행동을 정확히 알려주지도 않음. 0.5점: 개체 행동 예측이 제한됨은 맞지만 종 평균/모든 개체 범위 일부가 빠짐. 0점: 모든 개체의 행동을 정확히 예측한다고 반대로 해석 또는 관련 없는 답. 판정 우선순위: 아래 0점의 뜻/관계 반전·근거 없는 단정·다른 대상 해석을 학생 자신의 해석으로 긍정하면 다른 일부가 맞아도 0점이다. 0.5점은 이런 오류 없이 요구 단위의 일부만 맞거나 빠진 답에 적용한다. 비지지 결론을 비지지라고 명확히 구별해 쓴 경우는 오답 해석을 긍정한 것이 아니다. 무응답은 null로 보존하고 0점으로 바꾸지 않는다. 한국어/영어의 동의 표현을 인정하며 철자·문법만으로 감점하지 않는다. 이 문항에서 요청하지 않은 세부사항은 추가로 요구하지 않는다.
