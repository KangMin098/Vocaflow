# v3 비교 쌍 작성 지침 (M4)

설계 정본: `docs/csat-learner/v3/CSAT_REASONING_DATA_V3.md` §ComparisonPair · Principle. 입력 `chunk-v3p-NN.json` → 출력 `chunk-v3p-NN.out.json`.

입력 쌍마다 기존(legacy) 비교 메모가 있지만 **검수된 적 없는 가설**이다. 양쪽 **전체 원문 · 발문 · 선지 · 정답 · v3 칸**을 직접 읽고,
두 문항이 실제로 같은 판단 구조를 공유하는지(또는 비슷해 보이는데 판정을 가르는 조건이 다른지) 판단한다.
같은 유형 · 같은 함정 이름만으로 대응을 만들지 않는다. 대응이 성립하지 않으면 `status: "not_applicable"` 과 이유를 쓴다(빈칸 채우기 금지).

## 출력

```json
{ "chunk": "v3p-01", "writer_run": "wr-v3p-01", "pairs": [ {
  "pair_id": "입력 그대로",
  "status": "ok | not_applicable | needs_review",
  "reason": "not_applicable · needs_review 일 때 필수",
  "kind": "same_structure | contrast | boundary",
  "left":  { "id": "…", "units_hash": "입력 그대로", "inquiry_hash": "입력 그대로" },
  "right": { "id": "…", "units_hash": "입력 그대로", "inquiry_hash": "입력 그대로" },
  "focus": "한 비교 관계를 한 문장으로(한국어)",
  "mappings": [ { "left": { "sentences": [3], "choices": [2] }, "right": { "sentences": [5], "choices": [4] }, "relation": "두 근거가 어떤 요구 조건 · 의미 변환으로 대응하는가" } ],
  "shared_conditions": ["두 문항에서 판정을 똑같이 만드는 조건"],
  "decisive_differences": [ { "text": "판정을 가르는 조건", "left_sentences": [4], "right_sentences": [6] } ],
  "principle": { "level": "bounded", "statement": "…", "when_applies": ["…"], "when_not": ["…"] },
  "limitation": "이 비교가 말하지 않는 것 · 범위"
} ] }
```

## 규칙

1. `mappings` 1~4개. 양쪽 모두 실제 문장 번호(입력 sentences 의 n)와, 선지가 관련되면 선지 번호를 단다. 근거 없는 대응 금지.
2. `kind` — same_structure: 같은 요구 · 같은 의미 변환으로 같은 판정. contrast: 비슷한 표현 · 같은 함정처럼 보이지만 판정이 갈린다. boundary: 같은 원리가 한쪽에서는 통하고 다른 쪽에서는 통하지 않는 경계.
   contrast · boundary 는 `decisive_differences` ≥1, same_structure 는 `shared_conditions` ≥1.
3. `principle` 은 선택. 두 검수된 사례가 실제로 지지할 때만 `level: "bounded"`(이 두 문항 범위의 조건부 원리). `generalized` 를 쓰지 않는다. 「항상 · 반드시 · 모든 문항」 같은 보편 단정 금지.
4. 출제자의 실제 의도 · 내부 사고를 단정하지 않는다(「출제자는 ~하려고 했다」 금지 → 「~로 볼 수 있다」).
5. 원문을 길게 옮기지 않는다. 영어 인용은 8단어 이하, 근거는 문장 번호로.
6. 해시 칸은 입력값을 그대로 복사한다(결속 — 한쪽 탐구가 바뀌면 이 쌍은 자동으로 stale).
7. **배제 근거는 입력 v3 `choices[].decisive` · `sentences` 와 대조한다** — legacy 메모의 근거 문장을 그대로 믿지 않는다(파일럿: 「original」 을 「natural」 의 근거로 잘못 옮김).
8. **contrast 는 판정이 실제로 갈릴 때만.** 두 오답이 같은 규칙으로 지워지면 표지 · 어휘의 차이가 있어도 same_structure 이고 그 차이는 limitation 에 쓴다. 한쪽은 문장 안에서, 다른 쪽은 다른 문장이 있어야 지워지면 boundary.
9. 공개 화면 문장이다 — 「9번 쌍」 같은 내부 참조 · 다른 쌍 언급을 쓰지 않는다. 같은 상대와의 대비가 이미 다른 쌍으로 있으면 limitation 에 밝히고, 같은 내용 반복이면 not_applicable(「중복」).
10. **not_applicable 전에 다른 선지 조합도 본다** — legacy 가 짚은 선지끼리 대응이 없어도 두 문항의 다른 선지(정답 포함)끼리 같은 규칙이 성립하면 그 조합으로 쓴다. 상대 문항이 다르면 「중복」이 아니다.
11. 각 쌍을 끝낼 때마다 파일에 저장하고 끝에 `node scripts/csat/compare-v3-validate.mjs --chunk v3p-NN` 이 오류 0 이어야 한다.
