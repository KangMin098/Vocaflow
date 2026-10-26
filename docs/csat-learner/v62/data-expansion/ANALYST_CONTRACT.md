# 문항↔TASK 심층 매핑 — 분석자 계약 (map-data-pilot-1)

> 대상: 청크를 채우는 AI 분석자. 출력은 **AI_PROPOSED** 다 — 사람 검수·학생 성취·Gold 가 아니다.
> 제품 관련성 계약(`apps/web/src/lib/csat/map/v62/relevance.ts`)을 따른다: AI 는 `relevance`(검토값)를 정하지 못한다. 두 독립 판정이 같을 때만 `candidateRelevance`(R1)로 옮긴다.
> 검증기: `scripts/csat/map/v62/data/pilot-lib.mjs validateRow` — 형식뿐 아니라 인용이 원문에 실제로 있는지, 21 TASK 를 빠짐없이 판정했는지, 정답이 공식 정답과 같은지 검사한다.

## 1. 관련성 4값 (연구 v1.4 정의 계승)

| 값 | 뜻 | 쓰면 안 되는 경우 |
|---|---|---|
| `direct` | 이 문항을 푸는 **한 실제 판단 경로에서 그 TASK 의 고유 수행**이 결정적으로 쓰이고, 원문의 특정 위치로 지목할 수 있다 | 유형 이름만 보고(「어법 문항이니 S5」) · 모든 문항에 공통인 일반 독해 |
| `indirect` | 그 수행이 경로에 쓰이지만 정답을 가르는 결정 지점은 아니다(전제·보조) | 「아마 도움이 될 것」 수준의 추측 |
| `not_applicable` | 원문·발문을 읽고 그 수행이 이 문항의 어떤 합리적 경로에도 필요 없다고 **근거를 들어** 말할 수 있다 | 판단을 못 했을 때(그건 `unknown`) |
| `unknown` | 원문으로 판정할 수 없다(시각 자료 누락 · 경로가 여럿이라 결정 불가 등) | 귀찮을 때 — 이유를 쓴다 |

- `direct`·`indirect` 는 반드시 `anchor: {field: passage|stem|choices, quote}` — quote 는 **해당 필드 원문을 그대로 복사**(3자 이상, 공백 차이만 허용). 의역·번역·말줄임 금지.
- `direct`·`indirect` 는 `task_distinction` 에 **가장 헷갈리는 인접 TASK 와 왜 다른지**를 쓴다(S2/S3, R3/R4, R5/R4, E2/E3, V2/V4, E1/E3 등).
- 「이 문항 오답 = 그 TASK 결손」이 아니다. 직접 관련은 학습자 결손·숙달을 뜻하지 않는다.

## 2. 문항당 출력 스키마

```json
{
  "item_id": "2026#18", "source_sha256": "<입력 그대로>", "status": "AI_PROPOSED",
  "passage_structure": "지문 구조·논리 관계(예: 배경→요청→세부 조건)",
  "design_hypothesis": "출제 설계 가설 — 가설임을 전제로",
  "stem_demand": "발문이 실제로 요구하는 사고",
  "decision_path": { "summary": "이 문항이 실제로 풀리는 판단 경로(40자 이상, 이 문항 고유)", "field": "passage", "quote": "경로의 결정 지점 원문" },
  "primary_task": "<direct 인 TASK id 하나>",
  "secondary_tasks": ["<direct/indirect TASK id>"],
  "links": [ { "task_id": "...", "relevance": "direct|indirect|not_applicable|unknown", "why": "...", "anchor": {"field": "passage", "quote": "..."}, "task_distinction": "..." } ],
  "answer_logic": { "answer": 2, "why": "정답이 성립하는 논리", "decisive_locus": {"field": "passage", "quote": "..."} },
  "distractors": [ { "choice": 1, "design": "어떤 오독을 노렸나", "distortion_type": "<enum>", "why": "원문 근거로 왜 틀렸나" } ],
  "directly_observable": ["<이 문항 응답으로 직접 확인 가능한 TASK — direct 중에서만>"],
  "not_observable": [ { "task_id": "...", "why": "선택형 응답으로는 왜 확인이 안 되나" } ],
  "teaching_principles": ["관련 교수 원리(짧게)"],
  "independent_assessment": { "eligibility": "candidate_if_unexposed|not_suitable", "reason": "..." }
}
```

- `links` 는 청크의 `tasks` 21개 각각 **정확히 한 번**.
- `not_applicable` 의 why 는 `decision_path` 에 비춰 그 수행이 경로 밖인 이유를 **짧게**(한 구절) 쓴다 — 상투문 반복은 허용하되 판정 자체는 문항마다 한다. `direct`·`indirect`·`unknown` 의 why, 오답 why, `decision_path`, `teaching_principles` 는 **문항 고유**여야 한다(검증기가 문항 간·TASK 간 반복을 막는다). 생성 스크립트로 출력을 찍어내지 않는다.
- `distractors` 는 공식 정답이 아닌 모든 선지(선지 없는 문항은 빈 배열).
- `distortion_type`: `scope_expand` 범위 확대 · `scope_shrink` 범위 축소 · `partial_truth` 부분 사실 · `reversal` 반대 · `unmentioned` 언급 없음 · `wrong_target` 대상 바꿈 · `mixed_attribution` 주체·속성 섞기 · `surface_word_match` 본문 낱말 재사용 · `overgeneralization` 일반화 · `causal_error` 인과 오류 · `off_demand` 본문엔 맞지만 발문에 안 맞음 · `form_error` 어법·형태 · `true_statement` 본문과 맞는 진술(일치·불일치 문항의 정답 아닌 선지 등) · `other`(why 에 설명). **검증을 통과하려고 맞지 않는 유형을 고르지 않는다** — 맞는 것이 없으면 `other`.
- `directly_observable`: 선택형 정답 하나로는 「근거를 지목했다」「자기 말로 중심을 만들었다」가 확인되지 않는다. 정답 선택만으로 확인되는 것과 아닌 것을 엄격히 가른다. 대부분 문항은 `not_observable` 이 길다.
- `independent_assessment`: 학습자가 이 문항을 처음 본다면 해당 TASK 의 독립 첫 시도 근거가 될 수 있는지. 단서 노출·다중 경로·시각 자료 의존이면 `not_suitable`.

## 3. 트랙

- **A**: `prior_analysis_unverified`(기존 v3 드레인 분석 — 검증 전) 를 참고할 수 있다. 그대로 옮기지 말고 원문으로 확인한다. 기존 분석과 다르면 원문을 따른다.
- **B**: 원문만. 기존 분석·다른 판정을 찾아보지 않는다.
- 두 트랙 모두 다른 청크 출력 파일을 읽지 않는다.

## 4. 금지

- 원문에 없는 인용 · 정답을 공식 정답과 다르게 쓰기 · 21 TASK 중 일부만 판정 · 유형명만으로 direct · 학습자 숙달·점수·시간 효과 주장 · 사람 검수·Gold 표현.
