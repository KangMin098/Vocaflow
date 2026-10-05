# rev4 재검증 미달 3건 adjudication — xm43-20261005-adj2

> 2단계(1단계 독립 분류 → 두 분류 공개 후 최종 분류) · Claude · Codex 새 context · 사람 판정 아님 · 원문 · 판정자 서술은 저장소 밖(operator/adjudication-v2-full.json). 원본 기대 판정 · rev4 결과는 고치지 않는다 — 정정은 이 기록으로만.

| 사례 | 회차 최종 | 기대 | 독립 Claude / Codex | 최종 Claude / Codex | **최종 분류** | 기대 수정 | 규칙 수정 | 사례 수정 | 권장 기대 Claude / Codex |
|---|---|---|---|---|---|---|---|---|---|
| R43-HA | UNRESOLVED | identified:R.inference | RULE_INSUFFICIENT / GOLD_WRONG | RULE_INSUFFICIENT / GOLD_WRONG | **ADJUDICATION_SPLIT** | split | split | split | identified:R.inference / identified:V.wrong_sense |
| R4-H1 | identified:R.inference | undetermined | RULE_INSUFFICIENT / GOLD_WRONG | GOLD_WRONG / SHARED_MODEL_BIAS | **ADJUDICATION_SPLIT** | true | false | false | identified:R.inference / identified:V.wrong_sense |

## 채택 규칙 적용(2026-10-05 사용자 지시)

- R6: R4-H1 최종 분류 ADJUDICATION_SPLIT → **candidate**
