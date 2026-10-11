# 탐구 데이터 작성 지침 (vNext2 · inquiry v1)

입력: `chunk-inq-NN.json` · 출력: 같은 폴더 `chunk-inq-NN.out.json` · 검증: `node scripts/csat/inquiry-drain-validate.mjs --chunk inq-NN`

이 데이터는 학습자가 **오답이 지문의 무엇을 유지하고 무엇을 바꿨는지**, **이 문항의 원리가 어떤 조건에서 통하고 어디서 안 통하는지**를
탐구하도록 화면(오답 설계 · 공통 원리 장면)에 그대로 보인다. 정답 맞히기 요령이 아니라 **설계 관계**를 쓴다.

## 반드시 읽고 대조할 것

문항마다 `stem`(발문) · `sentences`(지문 문장, n 은 화면 번호) · `choices`(선지, 1부터) · `answer`(공식 정답) · `analysis`(검수된 기존 분석)를 **모두** 읽는다.
기존 분석이 원문과 맞지 않으면 그대로 옮기지 말고 `status: "needs_review"` 와 `review_note` 로 이유를 쓴다(분석을 고치는 공정은 따로다).

## 출력 형식

```json
{ "chunk": "inq-NN", "items": [ {
  "id": "2026#22", "analysis_version": 5, "status": "ok",
  "distractors": [ {
    "n": 2, "truth": "false", "operation": "scope",
    "preserved": [ { "component": "대상", "text": "습관 형성" } ],
    "altered":   [ { "component": "범위", "from": "일부 사람에게", "to": "모든 사람에게" } ],
    "note": "대상은 그대로 두고 범위만 넓혀 지문이 말하지 않은 일반화를 만들었다"
  } ],
  "principle": {
    "statement": "선지가 지문의 대상을 그대로 쓰더라도 범위 · 한정어가 같아야 지문과 일치한다",
    "when_applies": ["지문이 한정어(some, often 등)로 주장 범위를 좁혀 둔 경우"],
    "when_not": ["지문 자체가 전칭 주장을 하는 경우 — 범위를 넓힌 선지가 오히려 일치할 수 있다"]
  }
} ] }
```

- `distractors`: **정답이 아닌 선지 전부**(보통 4개), 번호마다 한 번. 정답 번호는 넣지 않는다.
- `status`: `ok` · `needs_review`(기존 분석이 원문과 다름 — `review_note` 필수) · `needs_source`(원문 · 선지가 깨져 대조 불가 — `review_note` 필수, 이때 distractors/principle 은 빈 배열 · null 가능).

## 정의표 — 이 값만 쓴다

| 필드 | 허용 값 | 뜻 |
|---|---|---|
| `truth` | `false` | 선지 내용이 지문과 맞지 않는다(일반 오답) |
| | `true` | 선지 내용은 맞지만 정답이 아니다 — 입력의 `distractors_are_true: true` 유형(어법 정상 형태 · 내용 일치에서 일치하는 항목 · 도표에서 맞는 진술 등) |
| | `not_applicable` | 선지가 명제가 아니라 **위치 · 지시 대상**인 유형(입력 `slot_type: true` — 무관한 문장 · 문장 삽입 · 글의 순서 · 지칭). 그 자리/대상이 왜 성립하지 않는지(또는 왜 정상인지)를 note 에 쓰고, 바뀐 조건이 있으면 altered 에 `위치`·`역할`·`화자` 성분으로 쓴다(없으면 빈 배열) |
| | `unknown` | 원문만으로 참/거짓을 확정할 수 없다(도표 원본 없음 등) — note 에 이유 |
| `component` | 대상 · 관계 · 극성 · 범위 · 시점 · 강도 · 수치 · 역할 · 위치 · 형태 · 화자 · 인과 방향 | 선지 문장에서 유지/변경된 의미 성분 |
| `operation` | `paraphrase` 동의 재진술 · `abstraction` 추상화 · `compression` 압축 · `inference` 추론 · `polarity` 극성 반전 · `scope` 범위 확대/축소 · `agent` 행위자 바꿈 · `reference` 지시 대상 바꿈 · `temporal` 시점 바꿈 · `degree` 정도 바꿈 · `causal_direction` 인과 방향 뒤집기 · `syntactic_form` 문법 형태 · `order` 순서/위치 · `numeric_relation` 수치 관계 · `unsupported` 지문에 없는 내용 끼워 넣기 · `none` 바꾼 것 없음 | 오답을 만든 **주된** 변환 하나 |

## 규칙

1. `truth: "false"` 오답은 `altered` 가 1개 이상, `preserved` 가 1개 이상이다 — 「무엇을 그럴듯하게 남기고 무엇을 바꿨나」가 이 장면의 핵심이다.
   `unsupported` 는 `from` 을 `"(지문에 없음)"` 으로 쓴다.
   예외: 빈칸 · 요약 · 낱말 상자처럼 선지가 **낱말 묶음**이고 모든 칸을 틀린 선지는 지문에서 남긴 성분이 없다 — `preserved: []` 로 두고 note 에 「모든 칸이 바뀌어 남은 지문 성분이 없다」를 밝힌다(문맥을 유지 성분으로 채우지 않는다).
2. `truth: "not_applicable"`(slot_type) 은 왜곡을 지어내지 않는다 — 무관한 문장 문항의 다른 문장은 흐름에 맞는 문장이고, 지칭 문항의 다른 밑줄은 공통 대상을 가리키는 정상 지칭이다. operation 은 `order`(위치) · `reference`(지칭) 또는 `none`.
3. `truth: "true"`(distractors_are_true 유형)는 **왜곡을 지어내지 않는다** — `operation: "none"`, `altered: []`, `note` 에 「왜 맞는 말/정상 형태인가」를 쓴다. 어법의 정상 밑줄을 「틀린 선지」라고 부르지 않는다.
4. `from` · `to` · `text` 는 짧게(한국어 설명 또는 **영어 8단어 이하 원문 인용**). 영어로 쓰면 그 문자열이 실제 지문 문장(`from`, `text`) 또는 그 선지(`to`)에 **그대로 있어야** 한다 — 검증기가 대조한다.
5. 문장 번호를 쓸 때는 입력 `sentences` 의 n 만 쓴다(「3번 문장」).
6. `principle` 은 **조건부**다: `statement` 1문장, `when_applies` 1~3개, `when_not` 1~3개(진짜 경계 — statement 의 부정을 반복하지 않는다).
   「항상」「무조건」「반드시」 같은 보편 법칙 · 정답 번호 분포 · 「출제자는 ~라고 생각했다」 같은 내부 사고 단정은 쓰지 않는다(분석자의 설계 가설이다).
7. 기존 분석(`analysis.choice_analysis`)의 함정 · 지우는 근거와 **모순되지 않게** 쓴다. 다르게 봐야 하면 needs_review.
8. 출력은 입력 청크의 모든 문항을, 입력의 `analysis_version` 을 그대로 복사해 쓴다.
