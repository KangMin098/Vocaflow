# rev4.2 재검증 결과 — 변경점별 채택 판정

> 사전 등록: [data/rev42-eval-spec.json](./data/rev42-eval-spec.json) (`020dee019`) · 코드북 `c7001aff97b0` · 최종 판정 봉인 `fa7afe3d1c73` · Claude × Codex 4중 blind · 사람 검증 아님 · 원문 없음.

## 세트별(따로 본다)

| 세트 | 건 | 최종 확정 | 미해결 |
|---|---|---|---|
| regression | 7 | 6 | C4-11 |
| holdout | 7 | 7 | — |
| surveillance | 0 | 0 | — |

퇴행 검사 — 기대가 정해진 Regression 5건 일치 **4/5** (기준 5/5 (rev4 회차(R6 은 rev4 와 같은 규칙))) → **퇴행 — rev4.2 전체 보류**

## R6 — **candidate 유지**

| 사례 | 구분 | 최종 | 기대 / 기준 | 통과 |
|---|---|---|---|---|
| R42-H1 | holdout | identified:V.wrong_sense | identified:V.wrong_sense | 예 |
| R42-H2 | holdout | identified:V.wrong_sense | identified:V.wrong_sense | 예 |
| R42-H3 | holdout | identified:R.inference | identified:R.inference | 예 |
| R42-H4 | holdout | identified:R.inference | identified:R.inference | 예 |
| R42-H5 | holdout | identified:V.wrong_sense | identified:V.wrong_sense | 예 |
| R42-H6 | holdout | identified:R.inference | identified:R.inference | 예 |
| R42-H7 | holdout | insufficient_evidence | insufficient_evidence | 예 |
| C4-11 | regression | — | identified:R.inference | 아니오 |
| H-13 | regression | identified:V.wrong_sense | identified:V.wrong_sense | 예 |
| H-05 | regression | identified:V.wrong_sense | identified:V.wrong_sense | 예 |
| C4-07 | regression | identified:R.inference | identified:R.inference | 예 |
| R4-H2 | regression | identified:R.inference | identified:R.inference | 예 |
| C2-02 | regression(수렴) | identified:V.wrong_sense | 두 adjudicator 권장 중 하나: identified:R.inference / identified:V.wrong_sense | 예 |
| R4-H1 | regression(수렴) | identified:V.wrong_sense | 두 adjudicator 권장 중 하나: identified:V.wrong_sense / multiple_plausible:R.inference\|V.wrong_sense | 예 |

## Surveillance — S.attachment(채택과 무관)


두 건 모두 다른 S 코드로 흡수: 아니오
