# v0.1 seed candidate 판정 (2026-10-05)

> 근거: 사전 등록 seed 조건 6개([ADJUDICATION_PLAN.md](./ADJUDICATION_PLAN.md) `a6e4670e4`) · rev4.3 재검증([REV43_EVAL.md](./REV43_EVAL.md)) · adjudication([ADJUDICATION_REV43.md](./ADJUDICATION_REV43.md)). Claude × Codex 교차검증이며 사람 검증이 아니다.

## 규칙별 상태

| 변경 | 상태 | 근거 |
|---|---|---|
| §6/R9(V vs S → R9) | **채택** | rev4 재검증 + R4-H6 GOLD_WRONG 합의 |
| R12(+ ② 고정 표현 판별) | **채택** | rev4.1 재검증 7/8 + N-04 GOLD_WRONG 합의 |
| R6(V.wrong_sense ↔ R.inference) | **미채택 — rev4.3 이 마지막 targeted 패치였다** | 아래 |

## R6 — rev4.3 결과

- 18건 중 16건 기준 통과 · 퇴행 없음(11/11) · rev4.2 holdout 7/7 유지 · **C4-11 이 4판정 모두 R.inference 로 일치**(rev4.2 에서 갈렸던 사례).
- 새 holdout: HB(직접 선택 → V) · HC(선택 + 추론 연쇄 → V) · HD(경로 증거 없음 → insufficient) 통과. **HA(사전 뜻 우연 일치 → R) 미해결**.
- R4-H1 은 R.inference 로 확정됐지만 사전 허용 범위 밖.
- 두 사례 adjudication 이 **같은 지점에서 갈렸다**: 학생이 「X 가 Y 라는 뜻이니까 …」 라고 쓴 증거를 Claude 는 「기본 뜻 인식 → 도출」(R), Codex 는 「다른 사전 뜻 직접 선택」(V)으로 읽었다. rev4.3 의 핵심 구분(기본 뜻 인식 vs 다른 사전 뜻 선택)이 **같은 증거에서 판정자마다 반대로 적용된다** — 규칙 문구가 아니라 경계의 조작적 정의 자체가 증거 수준에서 갈린다.
- 사전 등록(REV43_VALIDATION_PLAN): 「다시 실패하면 rev4.4 를 만들지 않고 ① 경계 재설계 ② seed 에서 명시적 unresolved 경계 ③ Pilot 까지 provisional ④ 필요 시 사람 전문가 검증 중에서 고른다」.

## 사전 등록 seed 조건 6개

| # | 조건 | 판정 |
|---|---|---|
| 1 | UNRESOLVED 0, 또는 사유와 함께 명시적 제외 | 미충족 — rev4.3 에 R43-HA 미해결(R6 경계). R6 경계를 명시적 unresolved 로 두면 충족 가능 |
| 2 | 같은 경계의 반복적 규칙 실패 없음 | **미충족** — R6 경계가 rev4 · rev4.1 · rev4.2 · rev4.3 에서 반복해 미달 |
| 3 | MODEL_SHARED_BIAS ≤ 25% | 충족 — 첫 adjudication 0/18 |
| 4 | identified / multiple_plausible 경계에 재현 가능한 규칙 | 충족 — §6/R9 채택(holdout · regression 통과, R4-H6 GOLD_WRONG) |
| 5 | 허용 대안이 필요한 기대 판정을 스키마에 반영 | 충족 — 정정은 새 회차 봉인 파일에(N-13 · N-04 등), 원본 봉인 파일은 그대로 |
| 6 | 코드북을 고쳤다면 바뀐 경계 subset 재-blind-run 통과 | §6/R9 · R12 충족 · R6 미충족 |

**판정: 사전 등록 기준 그대로는 v0.1 seed candidate 가 아니다**(조건 2 · 6 미충족, R6 경계 하나 때문).

## 남은 선택(사용자 결정 — rev4.4 는 만들지 않는다)

1. **경계 재설계** — V.wrong_sense / R.inference 의 조작적 정의를 「학생이 쓴 뜻 진술의 형식」이 아닌 다른 관찰 가능한 증거(예: 해석란에서 낱말 자리의 뜻과 구절 뜻을 따로 받는 증거 형식)로 다시 정의. 증거 수집 형식 변경이 따르므로 범위가 크다.
2. **seed 에 명시적 unresolved 경계로 포함** — 두 코드는 seed 에 넣되 이 경계의 판정을 provisional 로 표시하고, 두 판정이 갈리면 자동 확정하지 않고 사람 검토로 보낸다. 조건 1 은 충족, 조건 2 는 「명시적 예외」로 기록.
3. **Pilot 까지 두 코드 provisional** — 실제 학생 증거에서 이 경계가 얼마나 자주 · 어떤 형태로 나오는지 본 뒤 결정.
4. **사람 전문가 검증** — 이 경계만 좁혀서(약 20건) 사람 판정자 2명이 갈리는지 확인. 모델 둘이 같은 지점에서 갈린 것이 모델 편향인지 경계 자체의 모호함인지 가른다.

권장: **2 + 4** — seed 는 R6 경계를 provisional 로 명시해 진행하고, 그 경계만 사람 전문가 검증을 병행한다. 이 경계는 처방이 다른 두 원인(어휘 확인 vs 함축 · 비유 구성)이라 seed 에서 빼면 Pilot 에서 임의로 한쪽에 몰리기 쉽다.
