# 창작 세트 작성 계약(FINAL §5)

> 형식 계약 정본: `apps/web/src/lib/knowledge/authored/formats.ts`. 검증기: `validateAuthoredSet`(authored-items.ts). 이 문서는 작성자용 요약이다.
> AI 가 작성 · 검토한 세트는 **사람 Gold · 권리 확인 전**이다 — provenance 에 그렇게 적고, 승인처럼 쓰지 않는다.

## 공통

- 원창작만. 기출 · 교재 · 기사 지문을 옮기거나 고쳐 쓰지 않는다(`derivedFrom: []`). 실존 인물 · 기관의 구체 사실 주장 금지(일반화된 연구 · 사례로).
- 영어 지문 5–8문장, 수능 독해 수준(고3 · 120–170단어), 학술 · 교양 소재. 문장마다 하나의 문자열.
- 세트당 6문항: `model_explanation` 1 · `guided_practice` 1 · `independent_check` 2 · `transfer` 1 · `delayed_check` 1.
- **문항마다 서로 다른 지문 묶음(passageGroup)** — 교수 · 연습 지문과 평가 지문을 섞지 않는다. 평가 지문 문장을 교수 · 단서에 쓰지 않는다.
- 교수 문항: `body.teach` 3단계 이상 `{step, text, sentences}` — 출제자가 무엇을 재려고 이 문항을 어떻게 설계했는지(정답 설계 · 오답 설계 포함).
- 안내 문항: `body.hints` 1–3개 — 정답을 직접 말하지 않는다.
- 평가 문항: teach · hints 없음.
- 전이 문항: 같은 능력을 **다른 질문 모양**으로(예: 빈칸 → 요약문 빈칸, 문맥 의미 → 다른 품사 다의어).
- 정답 위치가 한 번호에 몰리지 않게.
- `body.format` 은 세트 형식과 같게.

## 형식별

### choice_evidence — e.evidence_location(빈칸 · 근거) · r.inference(함축 · 추론)
- body: `{format, sentences, stem, choices[5]}`. 빈칸형은 해당 문장에 `________` 를 넣는다.
- gold: `{answer, decisive, evidence[], evidenceAlt[], rationale, distractors[4]}` — decisive = 답을 정하게 만드는 결정 문장(evidence 에 포함). evidenceAlt = 근거로 골라도 감점하지 않는 보조 문장.
- distractors.design ∈ `opposed_view · too_narrow · off_text · distorted · reversed`, why ≥ 8자.

### option_correspondence — e.option_correspondence(내용 일치)
- body: `{format, sentences, stem:"다음 글의 내용과 일치하지 않는 것은?", choices[5](우리말)}`.
- gold: `{answer, options[5]: {verdict, sentence, why}}` — verdict ∈ `matches · distorted · not_in_text · reversed · too_narrow`. 불일치 발문이면 정답만 matches 가 아니고 나머지 4개 matches. not_in_text 의 sentence 는 null, 그 밖은 대응 문장 번호.

### contextual_sense — v.contextual_sense(문맥 의미)
- body: `{format, sentences, target:{sentence, word}, stem:"밑줄 친 낱말 'X'의 이 글에서의 뜻으로 가장 적절한 것은?", choices[5](우리말 뜻)}` — target.word 는 그 문장에 실제로 있는 다의어.
- gold: `{answer, cue[], senseGloss, distractors[4]}` — cue = 그 뜻을 정해 주는 문장들. design ∈ `basic_meaning · nearby_word · wrong_part_of_speech · collocation_mismatch · opposite_sense`.

### sentence_relation — r.relation(문장 사이 관계)
- body: `{format, sentences, stem:"표시된 두 문장 사이의 관계로 알맞은 것을 고르시오.", pairs:[[i,i+1], …](2–4쌍)}` — choices 없음.
- gold: `{pairs[]: {relation, alt[], cue}}` — relation ∈ `cause_effect · contrast · example · restatement · addition · sequence`. alt = 합리적으로 함께 인정할 관계(없으면 []). cue = 관계를 드러내는 단서 표현(연결어 · 지시어).

### form_scope — s.form_scope(어법)
- body: `{format, sentences, stem:"다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?", marks[5]: {sentence, text}}` — text 는 그 문장에 그대로 있는 표현(틀린 하나 포함). choices 없음.
- gold: `{answer, reason, correction, marks[5]: {reason, why}}` — reason ∈ `agreement · tense_aspect · voice · relative_clause · participle · parallelism · comparison_scope · negation_scope · infinitive_gerund · pronoun_reference`. 맞는 밑줄도 「어떤 규칙으로 맞는지」를 reason · why 로.
