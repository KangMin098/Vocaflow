# v3 비교 쌍 독립 검수 지침 (M4 · 기준 pair-v1.0)

작성자와 다른 run 이 양쪽 **전체 원문 · 발문 · 선지 · 정답 · v3 칸**(입력 `chunk-v3p-NN.json`)과 작성 결과(`.out.json`)를 대조한다.
해시는 `node scripts/csat/compare-v3-build.mjs --hash v3p-NN` 의 현재 값을 붙인다. 판정 파일 `review-v3p-<라벨>.json`:

```json
{ "reviewer": "rv-v3p-01", "criteria": "pair-v1.0", "verdicts": [ { "pair_id": "…", "verdict": "pass | revise", "content_hash": "…", "codes": ["P2"], "why": "한국어 · revise 면 구체적 수정안" } ] }
```

`status` 가 ok 가 아닌 쌍도 판정한다 — not_applicable 의 이유가 원문과 맞으면 pass(공개되지 않는다), 실제로는 대응이 성립하면 revise.

| 코드 | revise 사유 |
|---|---|
| P1 | 대응(mappings)의 문장 · 선지 번호가 원문과 맞지 않거나, 두 근거가 실제로 같은 요구 조건 · 의미 변환으로 대응하지 않는다(유형 · 함정 이름만 같음) |
| P2 | `kind` 가 틀렸다(같은 구조인데 contrast, 판정이 갈리는데 same_structure 등) |
| P3 | 공통 조건 · 가르는 조건이 원문과 맞지 않거나 판정을 실제로 가르지 않는다 |
| P4 | 원리가 두 사례를 넘어 일반화했다(보편 단정 · generalized) · 두 사례가 지지하지 않는다 · 적용하면 안 되는 조건이 원리와 모순 |
| P5 | 출제자 내부 사고 단정 · limitation 없음 · 원문 장문 복제 |
| P6 | not_applicable 인데 실제로 대응이 성립한다(또는 그 반대) |

**kind 정의(P2 판정 기준 — 모든 검수자 동일):**
- same_structure: 두 근거가 같은 규칙으로 같은 판정(정답끼리 · 오답끼리). 겉모양(표지 · 어휘 · 틀린 방식)의 차이는 limitation 몫이지 kind 를 바꾸지 않는다.
- contrast: 비슷한 표현 · 같은 단서가 **한쪽에서는 정답 쪽, 다른 쪽에서는 오답 쪽**으로 판정이 실제로 갈린다. 「지우는 근거의 종류가 다르다」만으로는 contrast 가 아니다(그건 not_applicable 이거나 boundary).
- boundary: 같은 규칙이 한쪽은 그 문장 안에서, 다른 쪽은 다른 문장이 있어야 성립하는 등 **적용 범위의 경계**를 보여 준다.
- 같은 상대 선지가 여러 쌍에 반복되는 것은 상대가 다르면 중복이 아니다. 근거 · 대비가 사실상 같으면 P6.

메모만 남길 것: 문체 · 더 나은 표현 제안. 같은 기준을 모든 쌍에 똑같이 적용한다.
