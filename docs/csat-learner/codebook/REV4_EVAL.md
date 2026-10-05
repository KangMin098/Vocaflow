# rev4 재검증 결과 — 변경점별 채택 판정

> 사전 등록: [REV4_VALIDATION_PLAN.md](./REV4_VALIDATION_PLAN.md) (`c406cbd09`) · 코드북 `f72c37c58407` · 최종 판정 봉인 `f2f2eb037ffa` · Claude × Codex 4중 blind · 사람 검증 아님 · 원문 없음.

## 세트별(따로 본다)

| 세트 | 건 | 최종 확정 | 미해결 |
|---|---|---|---|
| regression | 12 | 12 | — |
| holdout | 7 | 6 | R4-H1 |
| surveillance | 2 | 2 | — |

퇴행 검사 — 기대가 정해진 Regression 9건 일치 **8/9** (기준 7/9 (rev3)) → 퇴행 없음

## R6 — **candidate 유지**

| 사례 | 구분 | 최종 | 기대 / 기준 | 통과 |
|---|---|---|---|---|
| R4-H1 | holdout | — | identified:V.wrong_sense | 아니오 |
| R4-H2 | holdout | identified:R.inference | identified:R.inference | 예 |
| C4-11 | regression | identified:R.inference | identified:R.inference | 예 |
| H-13 | regression | identified:V.wrong_sense | identified:V.wrong_sense | 예 |
| H-05 | regression | identified:V.wrong_sense | identified:V.wrong_sense | 예 |
| C4-07 | regression | identified:R.inference | identified:R.inference | 예 |
| C2-02 | regression(수렴) | identified:V.wrong_sense | 두 adjudicator 권장 중 하나: identified:R.inference / identified:V.wrong_sense | 예 |

## R12 — **candidate 유지**

| 사례 | 구분 | 최종 | 기대 / 기준 | 통과 |
|---|---|---|---|---|
| R4-H3 | holdout | identified:V.unknown_word | identified:V.unknown_word | 예 |
| R4-H4 | holdout | identified:V.wrong_sense | identified:V.wrong_sense | 예 |
| R4-H5 | holdout | identified:V.multiword | identified:V.multiword | 예 |
| N-13 | regression | multiple_plausible:V.multiword\|V.wrong_sense | identified:V.multiword | 아니오 |
| H-17 | regression(수렴) | identified:V.unknown_word | 두 adjudicator 권장 중 하나: identified:V.unknown_word / identified:V.wrong_sense | 예 |
| N-04 | regression(수렴) | identified:V.multiword | 두 adjudicator 권장 중 하나: identified:V.multiword / multiple_plausible:V.multiword\|V.wrong_sense | 예 |

## R9_section6 — **candidate 유지**

| 사례 | 구분 | 최종 | 기대 / 기준 | 통과 |
|---|---|---|---|---|
| R4-H6 | holdout | identified:V.multiword | multiple_plausible:R.inference\|V.multiword | 아니오 |
| R4-H7 | holdout | insufficient_evidence | insufficient_evidence | 예 |
| N-15 | regression | insufficient_evidence | insufficient_evidence | 예 |
| N-05 | regression | insufficient_evidence | insufficient_evidence | 예 |

## Surveillance — S.attachment(채택과 무관)

- R4-S1: identified:S.attachment (FINAL_VERIFIED)
- R4-S2: identified:S.attachment (FINAL_VERIFIED)

두 건 모두 다른 S 코드로 흡수: 아니오
