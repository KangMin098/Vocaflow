# 탐구 데이터 독립 검수 지침 (inquiry v1)

작성자와 **다른** 에이전트가 원문과 출력을 대조해 문항마다 pass / revise 를 판정한다. 형식 검사(validate)는 이미 통과한 출력이다 —
여기서는 **내용이 원문과 맞는지**만 본다. 정의표는 `WRITER.md` 와 같다(다시 쓰지 않는다 — 먼저 읽는다).

## 판정 기준 — 하나라도 해당하면 revise

| 코드 | 결함 |
|---|---|
| R1 | `preserved` 의 성분이 실제로 그 선지에 남아 있지 않다(지문과 선지를 대조해 확인) |
| R2 | `altered` 의 from → to 가 그 선지가 실제로 바꾼 것이 아니다 · from 이 지문 내용이 아니다 |
| R3 | `truth` 가 틀렸다(맞는 선지를 거짓이라 함 · 그 반대 · 위치/지칭 선지를 명제로 취급) |
| R4 | note 가 원문과 모순되거나 문장 번호가 틀렸다 |
| R5 | 원리가 이 문항이 보여 주지 않는 일반 법칙이다 · when_not 이 진짜 경계가 아니다(statement 의 단순 부정) |
| R6 | 기존 분석(choice_analysis)의 정답 근거 · 함정과 모순된다 |

가벼운 문체 문제는 pass(메모만). 판정 근거를 원문 문장 번호로 쓴다.

## 출력

`review-<검수자 라벨>.json`:

```json
{ "reviewer": "rv-01", "verdicts": [ { "id": "2026#22", "verdict": "pass" }, { "id": "2026#23", "verdict": "revise", "codes": ["R2"], "why": "선지 3의 from 은 5번 문장 내용이 아니라 …" } ] }
```

## 공개 가드 결속 (v3 M2 · 2026-10-12 — 필수)

판정 파일은 이제 **검수한 내용에 묶여야** 공개된다(`scripts/csat/lib-inquiry-review.mjs`). 먼저
`node scripts/csat/inquiry-drain-hash.mjs --chunk inq-NN` 으로 문항별 해시와 작성 run 을 받고, 판정마다 아래를 쓴다:

```json
{ "reviewer": "rv-xx", "criteria": "inquiry-v1.2", "verdicts": [ { "id": "2026#22", "verdict": "pass", "content_hash": "<해시>" } ] }
```

- `reviewer` 는 작성 run(`writer_run`)과 달라야 한다 — 자기 검수는 verified 가 되지 않는다.
- 작성자가 내용을 고치면 해시가 바뀌어 이전 pass 는 효력을 잃는다(재검수 필요). 파일 이름 순서는 판정에 영향이 없다.
- 해시 없는 옛 판정은 `legacy`(2026-10-11 이전 공개분 보존)로만 남는다 — 새 공개분은 반드시 해시를 붙인다.
