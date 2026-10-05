# rev4.1 재검증 결과 — 변경점별 채택 판정

> 사전 등록: [data/rev41-eval-spec.json](./data/rev41-eval-spec.json) (`b00403014`) · 코드북 `f2bfcb6eca8c` · 최종 판정 봉인 `d7cd2351a9ef` · Claude × Codex 4중 blind · 사람 검증 아님 · 원문 없음.

## 세트별(따로 본다)

| 세트 | 건 | 최종 확정 | 미해결 |
|---|---|---|---|
| regression | 13 | 13 | — |
| holdout | 4 | 4 | — |
| surveillance | 0 | 0 | — |

퇴행 검사 — 기대가 정해진 Regression 9건 일치 **8/9** (기준 8/9 (rev4 회차(N-13 은 adjudication 정정 기대 V.wrong_sense 기준))) → 퇴행 없음

## R6 — **candidate 유지**

| 사례 | 구분 | 최종 | 기대 / 기준 | 통과 |
|---|---|---|---|---|
| R41-H1 | holdout | identified:R.main_point | identified:V.wrong_sense | 아니오 |
| R41-H2 | holdout | identified:S.operator_scope | identified:R.inference | 아니오 |
| C4-11 | regression | identified:V.wrong_sense | identified:R.inference | 아니오 |
| H-13 | regression | identified:V.wrong_sense | identified:V.wrong_sense | 예 |
| H-05 | regression | identified:V.wrong_sense | identified:V.wrong_sense | 예 |
| C4-07 | regression | identified:R.inference | identified:R.inference | 예 |
| R4-H2 | regression | identified:R.inference | identified:R.inference | 예 |
| C2-02 | regression(수렴) | identified:R.inference | 두 adjudicator 권장 중 하나: identified:R.inference / identified:V.wrong_sense | 예 |
| R4-H1 | regression(수렴) | identified:R.inference | 두 adjudicator 권장 중 하나: identified:V.wrong_sense / multiple_plausible:R.inference\|V.wrong_sense | 아니오 |

## R12 — **candidate 유지**

| 사례 | 구분 | 최종 | 기대 / 기준 | 통과 |
|---|---|---|---|---|
| R41-H3 | holdout | identified:V.wrong_sense | identified:V.wrong_sense | 예 |
| R41-H4 | holdout | identified:V.multiword | identified:V.multiword | 예 |
| R4-H3 | regression | identified:V.unknown_word | identified:V.unknown_word | 예 |
| R4-H4 | regression | identified:V.wrong_sense | identified:V.wrong_sense | 예 |
| R4-H5 | regression | identified:V.multiword | identified:V.multiword | 예 |
| N-13 | regression | identified:V.wrong_sense | identified:V.wrong_sense | 예 |
| H-17 | regression(수렴) | identified:V.unknown_word | 두 adjudicator 권장 중 하나: identified:V.unknown_word / identified:V.wrong_sense | 예 |
| N-04 | regression(수렴) | identified:V.wrong_sense | 두 adjudicator 권장 중 하나: identified:V.multiword / multiple_plausible:V.multiword\|V.wrong_sense | 아니오 |

## Surveillance — S.attachment(채택과 무관)


두 건 모두 다른 S 코드로 흡수: 아니오

## 실행 기록

- 첫 실행(xm41-20261005)은 검증기 결함으로 폐기 — 규칙 식별자 허용 범위가 R1–R11 로 고정돼 R12 인용 출력이 전부 무효 처리됐다(17건 중 11건 미해결). 허용 범위를 회차 코드북 본문 규칙 표에서 읽도록 고친 뒤 새 폴더(xm41b-20261005)에서 처음부터 다시 돌렸다. 폐기 회차는 실행 폴더에 보존.
