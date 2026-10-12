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

## v3 칸 판정 기준 (WRITER_V3.md) — 하나라도 해당하면 revise

| 코드 | 결함 |
|---|---|
| R7 | meanings 의 `meaning_ko` 가 그 영어의 문맥 의미가 아니거나 `scope`(부정 · 조건 · 행위자 · 시점 · 수량 · 대조 · 지시)의 범위가 틀렸다 |
| R7-경계 | **revise:** ① `meaning_ko` 가 인용에 없는 부정 · only/만 · 수치 · 비교 · 배타(only/unique)를 **주장**한다 ② 인용 밖 낱말이 **선지 판정(decisive)을 가른다**(예: on or before 의 on or 를 잘라 당일이 빠짐) ③ `scope.kind` 를 정당화하는 낱말이 인용에도 note 에도 없다. **pass(메모만):** `scope.note` 가 인용 밖의 접속어 · 조건절 · 대조어 · 시점어를 문맥으로 짚을 뿐 `meaning_ko` 는 인용 범위 안 · 행위자 · 지시 대상 문맥. (2026-10-12 — 같은 패턴을 검수자마다 다르게 판정해 수정이 반복된 뒤 고정) |
| R8 | choices 의 정답 선정 · 내용 참거짓 · 발문 충족이 섞였거나 틀렸다(부정형 발문의 정답은 내용 false · 충족 satisfies 일 수 있다) · decisive 조건이나 근거 문장이 틀렸다 |
| R9 | design 의 근거 수준이 틀렸다(관찰을 가설로, 가설을 공식으로) · 실제 출제 과정을 단정했다 · limitation 이 없다 |
