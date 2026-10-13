# 본시험 우선 재파일럿 규칙 v1.1

2026-10-14. 이전 v1.0/1.0.1의 최초32판정과 계산은 그대로 보존한다. 이번 변경은 이전 결과를 보고 만든 새 코드북이다. 기존 표본에 적용해 최초 일치도가 개선됐다고 주장하지 않는다. 새 본시험32문항의 첫 판정 전에 이 파일·선정 코드·manifest·입력 hash를 git commit으로 등록한다. T-0025, 연구 전용 브랜치. DB/UI/기존 v3 변경 및 main 병합은 제외한다.

## 표본과 독립성

2014~2024학년도 본시험만 사용하고 2025~2026은 열지 않는다. 고정2026-10-12 DB snapshot을 이용하며 최신 DB를 재감사했다고 말하지 않는다. 기존 파일럿의 공유지문·정규화 동일 본문·기록된 사전 노출을 제외한다. 기존 공개 여부는 입력 운영 상태의 선정 기준일 뿐 AI 분석 내용은 열지 않는다. 보류 자료는 별도 원장에 남겨둔다.

선정은 `select-main-pilot.mjs`: 희귀 유형부터 각1개, 이미 선정된 책자가 적은 후보 우선, 동률은 고정 SHA256 순서. 빈칸·순서·삽입·주제·내용·어휘를 보충해32개로 고정한다. 학년도와2014 A/B는 분리한다. 목적 표집이며 전수 분포를 추정하지 않는다. 최소32문항/24지문은 유지하고 가능한 유형 수는 실제 manifest대로 보고한다.

두 신규 `fork_turns:none` AI 문맥에 같은 고정 입력과 이 규칙을 준다. 이전 A/B 판정·v3·정답·해설·비교쌍을 읽지 않는다. 필요한 실제 문제 PDF의 같은 형/쪽 이미지는 허용 입력에 포함한다. 정답 PDF는 분류자에게 금지하며 source 감사자가 별도로 읽는다. 모형 사전학습 미노출/완전한 파일 접근 감사는 보장하지 않는다. 첫 완성32개를 저장하고 hash를 동결한 후에만 저장 정답을 공개한다. 부분 초안은 별도 로컬 파일에 보존한다.

## 독립9축과 변경점

담화·언어 복잡성·명제 성분·추론·평가 요구·설계 재구성의 기본 정의는 등록본 v1.0을 따른다. 함축 의미는 `lexical_context`(표현의 맥락 뜻)이며 빈칸 `complete`와 구분한다. 어휘/어법 오류 선택의 공식 선택답과 표현의 적합성은 별개다. 인지 과정/교수 효과/개별 출제자의 실제 의도를 확정하지 않는다.

**관계 축**: `decisive_relations`는 답과 경쟁 보기를 구분하는 데 필요한 문장 간 관계만 기록한다. 주변 배경 관계는 `background_relations`로 분리하고 주지표에 섞지 않는다. 각 결정 관계에는 두 실제 단위의 짧은 anchor와 연결 이유를 붙인다. 한 문장 내부 형식 의존만으로 판단하는 어법은 담화 관계를 억지 부여하지 않는다.

코드: `contrast`, `causal`, `example`, `elaboration`, `restatement`, `sequence`, `reference`, `condition`, `concession`, `problem_solution`, `list`, `other`, `none`. 이전 cause/result는 동일 방향의 인과 연결인 `causal`로 합친다. 조건은 P이면 Q라는 성립 제한, 양보는 기대와 실제가 어긋나는 수용, 대조는 동일 차원 두 명제의 차이이다. example은 일반 명제→구체 사례, elaboration은 새 상세 정보, restatement는 핵심 의미 반복이다. `none`은 필요한 문장 간 관계가 없다는 명시적 판단이며 빈 값/미해결이 아니다. 복수 코드는 가능하되 왜 각 관계가 답 판정에 필요한지 설명한다. `none`과 다른 코드를 함께 쓰지 않는다.

**보기 축**: 다섯 보기 각각 `content`와 `fit`을 분리한다. content=`entailed|contradicted|unsupported|underdetermined|not_propositional`; fit=`fits|fails|unresolved`. 표현·연결어·삽입 위치·대명사·형태처럼 독립 사실 명제가 아닌 후보는 not_propositional이다. `failure`=`none|scope|agent|polarity|unsupported|grammar|lexical|coherence|numeric|task|other`. ‘틀린 것’을 고르는 문항에서는 contradicted인 후보의 fit이 fits일 수 있다. 원문에 없는 내용은 반대가 증명되지 않으면 contradicted로 처리하지 않는다. 이유는 실제 과제 조건을 명시한다. 정답 번호만 같다고 코드 타당성을 인정하지 않는다.

**전략 축**: 각각 `{status, units, reason}`으로 기록한다. status=`applicable|insufficient|not_applicable|unresolved`. units는 전략 단독으로 허용한 실제 근거 anchor이다. 모든 판단은 설명상 충분성의 가설이며 학생의 실제 행동·시간 측정이 아니다.

- contrast: 선택한 대비 명제 양쪽만 허용. 사례/인과/전역 요약을 추가하면 단독 전략 성공이 아니다.
- core_sentence: 실제 한 완성 문장+발문/보기만 허용. 문장의 지시 대상을 외부 문장으로 복원해야 하면 insufficient이다.
- incremental: 제시 순서에서 절 의미와 지시를 누적·수정하는 읽기. 순서 재배열이 별도 필수인 경우 그 추가 행동을 단독 전략으로 소급하지 않는다.
- syntax: 결정적인 한 국소 문법/수식/범위 의존과 그 표현의 어휘 의미만 허용. 별도 담화 연결이 필수이면 insufficient이다.
- selective: 이번 지표는 **연속 최대2문장 또는 실용문 항목2개**+발문/보기만으로 다섯 후보를 판별하는 좁은 전략이다. 전체로 확대하는 적응적 읽기와 분리한다. 도표는 지정된 최대2행/열만 허용한다. 임의로 글 전체를 읽고 selective 적용으로 세지 않는다. 이 새 지표를 이전 포괄적 selective와 같은 척도로 비교하지 않는다.

## 출력 계약

각 행: `id,binding,solved_answer,discourse,complexity,proposition,decisive_relations,background_relations,relation_edges,inference,task,choices,design,strategies,evidence,source_status,unresolved`.

complexity=`scope|embedding|anaphora|polysemy|ellipsis|none_observed`, proposition=`agent|predicate|object|polarity|time|condition|quantifier|modality`. 담화=`practical|exposition|argument|narrative|data|mixed|unresolved`. 추론=`explicit|local|global|contextual|visual_numeric|structural_grammar`. task는 v1.0의13개 값을 따른다.

relation_edges=`[{relation,from,to,why}]`; from/to는 원문 anchor 각60자 이내. none일 때 빈 배열을 허용한다. choices=`[{n,content,fit,failure,why}]` 정확히1~5. design=`{level:"hypothesis",statement}` 또는 실제 논리 재구성의 logical, 공식 기록이 없으면 official_documented 금지. evidence=`[{anchor,why}]` 최소1개, anchor60자 이내. strategies의5개 키는 이전 이름(contrast,core_sentence,incremental,syntax,selective)을 사용하되 위의 새 제한을 따른다. 근거 전문과 선지는 커밋하지 않는다.

## 대조와 확대 기준

명목 범주는 원시 일치·κ·교차표, 다중 코드는 Jaccard·코드별 이진 일치를 보고한다. decisive 관계와 background 관계를 별도 측정한다. 보기 content/fit/failure는 문항 내 종속160쌍의 기술 통계로만 표시한다. none는 실질 범주이므로 none끼리 일치지만 빈 집합은 결측/유사도0이다. unresolved는 확대용 성공으로 세지 않는다. 지문 군집과 입력 결함을 보존한다.

작업 문턱은 담화/요구 각≥80%, 결정 관계/추론 평균Jaccard≥70%, 전략별exact≥80%, unresolved≤10%, 필수근거/결속 오류0. κ의 범주 편중과 무변별을 별도 보고하며 수치만으로 확인적 확대를 허용하지 않는다. 원문·제시 표시/보기·동일형 정답표의 직접 전체 대조 완료분만 확인적 근거에 포함한다. 전체 대조는 부분24자 포함률과 구분한다. 서로 다른 관계 정의·표본으로 일치도가 바뀐 것을 순수한 코드북 개선의 인과 효과라고 표현하지 않는다.

원문 수정이 필요하면 최초 저장 입력을 덮지 않고 새 버전·이유·영향 ID·hash를 남긴다. 오류 문항은 최초32분모에서 숨기지 않는다. 두 판정은 합의로 덮지 않으며 논리 반례/복수 타당/미해결/코드북 결함을 별도 보존한다. 인간 전문가 검수와 교수 효과는 여전히 미확정이다.
