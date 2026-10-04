# rev4 재검증 미달 3건 adjudication — xm4-20261005-adj2

> 2단계(1단계 독립 분류 → 두 분류 공개 후 최종 분류) · Claude · Codex 새 context · 사람 판정 아님 · 원문 · 판정자 서술은 저장소 밖(operator/adjudication-v2-full.json). 원본 기대 판정 · rev4 결과는 고치지 않는다 — 정정은 이 기록으로만.

| 사례 | 회차 최종 | 기대 | 독립 Claude / Codex | 최종 Claude / Codex | **최종 분류** | 기대 수정 | 규칙 수정 | 사례 수정 | 권장 기대 Claude / Codex |
|---|---|---|---|---|---|---|---|---|---|
| R4-H6 | identified:V.multiword | multiple_plausible:R.inference\|V.multiword | GOLD_WRONG / GOLD_WRONG | GOLD_WRONG / GOLD_WRONG | **GOLD_WRONG** | true | false | split | identified:V.multiword / identified:V.multiword |
| R4-H1 | UNRESOLVED | identified:V.wrong_sense | SHARED_MODEL_BIAS / CASE_CONSTRUCTION | CASE_CONSTRUCTION / SHARED_MODEL_BIAS | **ADJUDICATION_SPLIT** | split | split | split | multiple_plausible:R.inference\|V.wrong_sense / identified:V.wrong_sense |
| N-13 | multiple_plausible:V.multiword\|V.wrong_sense | identified:V.multiword | RULE_INSUFFICIENT / GOLD_WRONG | GOLD_WRONG / GOLD_WRONG | **GOLD_WRONG** | true | split | true | identified:V.wrong_sense / identified:V.wrong_sense |

## 채택 규칙 적용(2026-10-05 사용자 지시)

- §6/R9: R4-H6 이 GOLD_WRONG 합의면 채택 → **adopt**
- R6: R4-H1 이 RULE_INSUFFICIENT · TAXONOMY_OVERLAP 이면 candidate, CASE_CONSTRUCTION · GENUINELY_UNRESOLVED 면 재평가 → **candidate**
- R12: N-13 이 RULE_INSUFFICIENT · TAXONOMY_OVERLAP 이면 candidate → **re-evaluate(기대 오류)**

## 한계

- 1단계에서 기대 판정 · 회차 모델 판정을 공개했다(실패 원인 분류에 필요 — 사용자 지시 절차). 1단계 own_verdict 는 독립 판정이 아니다. 두 adjudicator 는 서로의 분류만 1단계에서 보지 못했다.
- 판정 지시문의 공통 규칙 문구가 「코드북 rev3」로 남아 있었다(본문은 rev4) — rev4 재검증 판정자 패킷과 이 adjudication 모두. Codex 근거에 「rev3 R6」 표기가 보이는 이유다. 규칙 본문은 rev4 였다. **더 큰 결함**: 같은 공통 문구가 「적용 규칙(R1–R11)만 따른다」였다 — rev4 재검증 판정자는 코드북 본문에서 R12 를 보면서도 「R11 까지」 지시를 받았다. R12 평가(N-13 포함)가 이 지시에 흐려졌을 수 있다. 도구는 판본 · 규칙 범위를 코드북에 맞추도록 고쳤다(다음 회차부터).
- 판정자 서술 전문은 저장소 밖 operator/adjudication-v2-full.json.
