# 끌리는 구절 드레인 — 청크 채우기 지시

입력 `chunk-NN.json` → 출력 `chunk-NN.out.json` (같은 폴더). 청크는 지문 원문을 담으므로 커밋하지 않는다.

각 오답(`distractors[]`)마다 **지문(passage) 안에서 학습자를 이 오답으로 끌어당기는 구절**을 하나 고른다.

- `trap` · `why_tempting` · `how_to_reject` 를 읽고, 그 설명이 가리키는 자리(오답 선지와 겹치는 낱말 · 오해를 부르는 표현 · 범위를 넘겨 읽게 하는 문장 조각)를 지문에서 찾는다.
- **지문 글자를 그대로 복사**한다(대소문자 · 구두점 · 철자 그대로). 20–80자, 한 문장 안의 연속 구절. 말을 바꾸거나 이어 붙이지 않는다.
- 정답 근거 구절과 같은 구절을 고르지 않는다(정답 자리 ≠ 끌리는 자리).
- 끌림이 지문 바깥(배경지식 · 선지 자체의 그럴듯함 · 지문에 없는 내용 덧붙이기)에서 오면 억지로 고르지 말고 `lure_quote: null`, `reason` 에 한 줄.

출력 형식:

```json
{ "chunk": "01", "items": [ { "item_id": "...", "analysis_id": "...", "version": 3,
  "distractors": [ { "n": 2, "lure_quote": "the fish will do just fine", "reason": null } ] } ] }
```

`item_id` · `analysis_id` · `version` 은 입력 그대로 옮긴다. 검증은 `lure-drain-import.mjs`(예행)가 한다 — 지문에 없거나 길이 밖이면 버려진다.
