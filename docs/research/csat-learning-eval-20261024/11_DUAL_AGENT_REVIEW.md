# 11 · 이중 에이전트 검수 규약 (사람 검수 대체 · 2026-10-24)

> 지침: 실제 사람 검수자를 기다리지 않는다. 검수 = **Claude Code(A) + Codex(B) 독립 이중 판정**, 만든 쪽 ≠ 판정한 쪽, 서로의 값과 초안(`review/ai-candidates-*.json`)을 보지 않는다. 정의표·엄격 검증기·일치율 0.85 하한을 판정 **전에** 고정한다.
> 이 규약은 이 커밋에서 고정되며, 판정 결과를 본 뒤 바꾸지 않는다. 바꿔야 하면 새 판본으로 다시 판정한다.
> 위임하지 않는 것: **연구 권리 범위**(법적 판단 — 사용자 결정), DB·제품 코드·main 변경. 실제 학습 효과는 이 검수로 정해지지 않는다(NOT_EVALUATED 유지).

## 1. 입력 — 검수 패킷

- `.review-packet/packet.json`(worktree 안, **git 제외** — 원문 포함, 커밋 금지). 20문항(기준 3 + 후보 17): 지문 문장 번호(분리 규칙 고정) · 발문 · 선지 · 공식 정답(§10-3 확인) · 형 · 기계 대조 비율 · revision 의미 충돌(옵션별 버전 라벨).
- 기준 구조 정의(같은 원리 판정용):
  - 22 `DISCOURSE_ROLE_COVERAGE` — 정답이 글의 역할(정의→진단→경향→**처방**)을 모두 덮는가. 처방 문장이 결정 근거.
  - 34 `CONDITIONAL_NEGATION_ENTAILMENT` — 한정·조건·**부정** 안에서 빈칸 명제가 귀결로 성립하는가. 조건 명제 판단은 이 구조에만 쓴다.
  - 38 `TWO_BOUNDARY_COHESION` — 주어진 문장이 앞 요구(지시어)와 **뒤 공급**(예시·연결)을 함께 만족하는가. 뒤 이음매가 결정적.
- 실패 코드표: `rubric/distractor-logic.json` `failure_codes`(UNCODED 제외 19개).

## 2. 판정 칸 (문항마다)

| 칸 | 값 | 정의 |
|---|---|---|
| `original.verdict` | CONFIRM · REJECT · UNSURE | 패킷 지문·선지가 온전한 기출 문항으로 읽히는가(문장 흐름 단절 · 선지 조각 혼입 · 각주 섞임 · 기계 대조 비율 <0.8 이면 REJECT/UNSURE) |
| `evidence.decisive` | 문장 번호 목록 | 정답을 결정하는 최소 근거 문장 |
| `evidence.accepted_alternatives` | 문장 번호 목록들 | 같은 관계를 보여 대체 근거로 인정할 문장 묶음 |
| `near_distractor` | option · failure_code · counter_evidence · reason | 가장 매력적인 오답, 실패 코드, 반증 문장 |
| `anchor_function`(후보만) | SAME · DIFFERENT · UNSURE + reason + non_application | 같은 유형 기준 문항과 **같은 출제 사고 기능**인가 · 이 문항에서 기준 원리가 적용되지 않는 조건 |
| `revision_options`(충돌 옵션만) | 버전에 있는 라벨 하나 또는 NONE | 지문을 읽고 그 오답의 실패 이유로 맞는 라벨 |

## 3. 엄격 검증기 (`tool/review-gates.mjs` `validateJudgments`)

문장 번호 범위 · 정답을 오답으로 고르기 금지 · 코드표 밖 코드 금지 · 이유 15자 이상 · 같은 이유 반복 금지(상투 이유) · 지문 30자 이상 복사 금지 · 모든 문항·충돌 옵션 판정 필수. **오류가 하나라도 있으면 그 판정 파일 전체를 집계하지 않는다**(다시 판정).

## 4. 합의 규칙 (`aggregate`)

- original: 둘 다 CONFIRM → 서명 수용.
- evidence: 결정 근거 Jaccard ≥ 0.5 이고 교집합이 있으면 일치 → gold = 교집합.
- near_distractor: 같은 옵션 + 같은 실패 코드 → 일치.
- anchor_function: 같은 판정이고 UNSURE 가 아니면 수용.
- revision_options: 같은 라벨이고 NONE 이 아니면 그 옵션 라벨 수용. 한 문항의 충돌 옵션이 모두 수용되면, 그 라벨 조합과 같은 revision 이 있을 때만 그 revision 을 `accepted_revision` 으로 둔다(없으면 「옵션 단위 수용」만).
- **게이트별 일치율 < 0.85 이면 그 게이트는 전 문항 반영하지 않는다.** 불일치 문항은 미수용으로 남는다(세 번째 판정자로 다수결 하지 않는다).
- 표본 대조: 오케스트레이터(Claude 메인 세션)가 수용된 판정 3건을 원문과 직접 대조해 기록한다.

## 5. AI-Control 결속

작업 owner `csat-learning-eval`(Claude) · 검수 B owner `csat-learning-eval-codex-review`(Codex). TASK 를 등록하고, 결과 커밋을 증거로 submit, Codex owner 가 complete/reject 한다.

## 6. SOURCE_READY 에 반영되는 것

수용된 칸만 `transfer/readiness.json` 의 해당 게이트를 채운다(`human_verdict` 자리에 `dual_agent_verdict` 와 근거 파일). 연구 권리(RESERVED)는 그대로 — 따라서 이 검수가 모두 통과해도 SOURCE_READY 는 권리 결정 전까지 참이 될 수 없다.
