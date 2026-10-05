# rev4.3 재검증 결과 — 변경점별 채택 판정

> 사전 등록: [data/rev43-eval-spec.json](./data/rev43-eval-spec.json) (`f8855b4ff`) · 코드북 `b3090d5c8425` · 최종 판정 봉인 `fa0f79c34302` · Claude × Codex 4중 blind · 사람 검증 아님 · 원문 없음.

## 세트별(따로 본다)

| 세트 | 건 | 최종 확정 | 미해결 |
|---|---|---|---|
| regression | 14 | 14 | — |
| holdout | 4 | 3 | R43-HA |
| surveillance | 0 | 0 | — |

퇴행 검사 — 기대가 정해진 Regression 11건 일치 **11/11** (기준 11/11 (rev4.2 회차(holdout 7/7 · 기대 일치 regression 4/4))) → 퇴행 없음

## R6 — **candidate 유지**

| 사례 | 구분 | 최종 | 기대 / 기준 | 통과 |
|---|---|---|---|---|
| R43-HA | holdout | — | identified:R.inference | 아니오 |
| R43-HB | holdout | identified:V.wrong_sense | identified:V.wrong_sense | 예 |
| R43-HC | holdout | identified:V.wrong_sense | identified:V.wrong_sense | 예 |
| R43-HD | holdout | insufficient_evidence | insufficient_evidence | 예 |
| C4-11 | regression | identified:R.inference | identified:R.inference | 예 |
| R42-H1 | regression | identified:V.wrong_sense | identified:V.wrong_sense | 예 |
| R42-H2 | regression | identified:V.wrong_sense | identified:V.wrong_sense | 예 |
| R42-H3 | regression | identified:R.inference | identified:R.inference | 예 |
| R42-H4 | regression | identified:R.inference | identified:R.inference | 예 |
| R42-H5 | regression | identified:V.wrong_sense | identified:V.wrong_sense | 예 |
| R42-H6 | regression | identified:R.inference | identified:R.inference | 예 |
| R42-H7 | regression | insufficient_evidence | insufficient_evidence | 예 |
| H-13 | regression | identified:V.wrong_sense | identified:V.wrong_sense | 예 |
| H-05 | regression | identified:V.wrong_sense | identified:V.wrong_sense | 예 |
| C4-07 | regression | identified:R.inference | identified:R.inference | 예 |
| R4-H2 | regression | identified:R.inference | identified:R.inference | 예 |
| C2-02 | regression(수렴) | identified:R.inference | 두 adjudicator 권장 중 하나: identified:R.inference / identified:V.wrong_sense | 예 |
| R4-H1 | regression(수렴) | identified:R.inference | 두 adjudicator 권장 중 하나: identified:V.wrong_sense / multiple_plausible:R.inference\|V.wrong_sense | 아니오 |

## Surveillance — S.attachment(채택과 무관)


두 건 모두 다른 S 코드로 흡수: 아니오
