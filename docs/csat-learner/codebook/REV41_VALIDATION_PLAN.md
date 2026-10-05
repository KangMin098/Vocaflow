# rev4.1 재검증 — 사전 등록 (2026-10-05 · 사례 작성 · 실행 전에 고정)

> 코드북: [CODEBOOK.rev4.1.md](./CODEBOOK.rev4.1.md) `f2bfcb6eca8c`(초안). rev4 의 §6/R9 는 채택됐다([ADJUDICATION_REV4.md](./ADJUDICATION_REV4.md)). 이번에는 candidate 로 남은 **R6 · R12 만** 다시 본다.
> 보완: R6 ④ 결정성 검사(고른 사전 뜻을 그대로 넣으면 학생 해석이 나오는가) · R12 ② 고정 표현 판별(구성 낱말 하나가 스스로 가진 뜻이면 고정 표현 아님).
> 절차: 같은 4중 blind. **판정 지시문 결함 수정 반영**(판본 · 규칙 범위를 코드북에 맞춤 — rev4 재검증에서 「R1–R11 만」 지시가 R12 평가를 흐렸을 수 있다). 사람 검증 아님.

## 세트(17건)

| 세트 | 사례 |
|---|---|
| Holdout(새 사례 4) | R41-H1 R6 ④ → 낱말 실패 결정적(`V.wrong_sense`) · R41-H2 R6 ④ → 대상 대응 실패(`R.inference`) · R41-H3 R12 ② 구성 낱말 자체 뜻(`V.wrong_sense`) · R41-H4 R12 ② 덩어리 전체 뜻(`V.multiword`) |
| Regression R6 | C4-11 · H-13 · H-05 · C4-07 · R4-H2(기대 일치) · C2-02 · R4-H1(수렴) |
| Regression R12 | R4-H3 · R4-H4 · R4-H5 · N-13(기대 일치) · H-17 · N-04(수렴) |

## 기대 판정

- 지난 회차 기대를 그대로 쓰되 **adjudication 정정만 반영**: N-13 → `identified V.wrong_sense`(ADJUDICATION_REV4 두 adjudicator GOLD_WRONG 합의 · 권장 일치). 원본 봉인 파일은 고치지 않고 새 봉인 파일에 적는다.
- 수렴 사례(권장이 갈렸던 것): FINAL_VERIFIED 이고 판정이 두 adjudicator 권장 중 하나 — C2-02 · H-17 · N-04(지난 회차와 같음) · R4-H1(`identified V.wrong_sense` / `multiple_plausible R.inference|V.wrong_sense`).
- 새 holdout 4건: 새 context 작성 에이전트가 rev4.1 로 기대를 쓰고 **실행 전 봉인**.

## 채택 기준 — [data/rev41-eval-spec.json](./data/rev41-eval-spec.json)(도구가 이 파일을 그대로 판정)

- 변경점마다: holdout 모두 `FINAL_VERIFIED` + 기대와 같음, regression 기대 일치 사례 모두 같음, 수렴 사례 모두 수렴. 하나라도 실패하면 그 변경은 candidate.
- 퇴행 없음: 기대가 정해진 9건 일치가 rev4 회차(8/9, N-13 정정 기준)보다 낮으면 rev4.1 보류.
- holdout 기대와 모델 합의가 다르면 adjudication(v2) 뒤에만 판단한다.

## 봉인 기록

(사례 작성 뒤, 실행 전에 채운다)
