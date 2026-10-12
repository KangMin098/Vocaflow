# 탐구 데이터 v3 작성 지침 (의미 · 판단 · 설계)

입력: `chunk-v3-NN.json`(원문 포함 · 커밋 안 함) · 출력: `chunk-v3-NN.out.json` · 검증: `node scripts/csat/inquiry-drain-validate.mjs --v3 --chunk v3-NN`
설계 정본: PR #223 `docs/csat-learner/v3/`(CSAT_LEARNING_PROCESS_V3 §3 · CSAT_REASONING_DATA_V3 §3). v1 정의표(`WRITER.md`)의 distractors/principle 규칙은 그대로다.

이 칸은 학습자가 **원문의 실제 영어 의미 → 발문이 요구하는 판단 → 각 선택지가 그 요구를 충족/실패하는 조건 → 그 관계를 설계에 이용했다는 해석**을
같은 근거 문장으로 따라가게 한다. 정답 요령 · 출제자 속마음 단정 · 한국어 라벨만으로 영어 이해를 대체하는 설명을 쓰지 않는다.

## 반드시 읽을 것

입력 문항의 `stem` · `sentences`(n 은 화면 번호이자 근거 ID) · `choices` · `answer` · 기존 `analysis` · 기존 v1 출력(`v1`)을 **모두** 읽는다.
문장 번호는 입력 `sentences` 의 n 만 쓴다. 입력 `units_hash` 를 출력에 그대로 복사한다(원문 분할이 바뀌면 근거 연결을 끄는 결속값).

## 출력 형식 (문항마다 v1 칸 + `v3`)

```json
{ "chunk": "v3-01", "writer_run": "wr-v3-01", "items": [ {
  "id": "2026#34", "analysis_version": 5, "status": "ok",
  "distractors": [ … v1 그대로 또는 고친 값 … ], "principle": { … },
  "v3": {
    "units_hash": "<입력 그대로>",
    "requirement": { "requested": "발문이 요구하는 판단(한국어 1문장)", "polarity": "positive|negative", "conditions": ["판단에 필요한 조건 1~3"], "reading_scope": "읽어야 하는 범위(예: 5~7번 문장)" },
    "meanings": [ { "id": "m1", "sentences": [6], "expression": "영어 원문 8단어 이하", "meaning_ko": "문맥 속 실제 의미", "scope": { "kind": "negation|condition|agent|time|quantity|contrast|reference|none", "note": "부정·조건 등이 어디까지 미치는가" } } ],
    "choices": [ { "n": 1, "selected_as_answer": false, "content_truth": "false|true|n_a|unknown", "requirement_fit": "satisfies|fails|unknown", "decisive": "이 선택지를 가르는 결정 조건(한국어)", "sentences": [6], "meaning_ids": ["m1"] } ],
    "design": { "claims": [ { "basis": "official|source_observation|design_hypothesis", "text": "주장", "sentences": [6] } ], "limitation": "확인하지 못한 부분 · 다른 해석 가능성" }
  }
} ] }
```

## 정의 · 규칙

1. `meanings` 2~6개: 판단에 필요한 핵심 영어 표현만. `expression` 은 그 문장에 **그대로 있는** 영어(8단어 이하). `meaning_ko` 는 사전 뜻이 아니라 **이 문맥의 뜻**,
   `scope` 는 부정 · 조건 · 행위자 · 시점 · 수량 · 대조 · 지시가 **어디까지 미치는지**(예: `cannot be` 가 빈칸 표현 전체를 부정한다). 전체 번역을 줄줄이 쓰지 않는다.
2. `choices` 는 **1~5번 전부**. 세 칸을 분리한다: `selected_as_answer`(공식 정답 번호인가) · `content_truth`(선지 내용이 원문과 맞는가) · `requirement_fit`(발문 요구를 충족하는가).
   - 부정형 발문(어법 · 불일치 · 무관한 문장 등): 정답은 `requirement_fit: satisfies` 이지만 `content_truth: false` 일 수 있다. 비선정 선지는 내용이 참(`true`)이고 요구는 `fails`.
   - 위치 · 지칭 선지(slot_type)는 `content_truth: n_a`.
   - 원문만으로 못 정하면 `unknown` + decisive 에 이유. 도표 원본 값이 입력에 없으면 수치 판정은 `unknown`.
3. `decisive` 는 그 선택지를 가르는 **하나의 결정 조건**을 근거 문장과 함께. 정답 선택지는 「전체 발문에 넣었을 때 성립하는 이유」.
4. `design.claims`: `official` 은 공식 정답 · 발문 같은 공식 사실만. 원문에서 직접 확인되는 것은 `source_observation`. 그 관찰을 판단 과제로 이용했다는 해석은 `design_hypothesis`(실제 출제 과정 · 제작 순서로 쓰지 않는다). `limitation` 필수.
5. 금지: 「항상 · 무조건 · 반드시」 보편 규칙, 「출제자는 ~라고 생각했다」, 정답 번호 분포, 원문에 없는 수치/유인 통계. v1 note · principle 이 원문과 어긋나면 고치고 `review_note` 에 이유.
6. 확인할 수 없는 칸은 지어내지 않는다 — `status: needs_source|needs_review` 와 `review_note`.
