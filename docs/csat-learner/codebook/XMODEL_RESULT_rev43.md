# Cross-Model Blind Dry Run 결과 — xm43-20261005

> Claude Code × Codex 4중 교차검증. **사람 판정이 아니다** — 이 수치는 cross-model agreement 이며 human reliability · 사람 검증이 아니다. 원문 · 판정 원본은 저장소 밖 실행 폴더에만 있다.

코드북 rev4.3-draft `b3090d5c8425` · 최종 판정 봉인 `fa0f79c34302` · 사례 18

## A. 1차(A1 Claude ↔ B1 Codex) cross-model 일치

| 지표 | n | 일치 | κ | AC1 | 내부 screening |
|---|---|---|---|---|---|
| family | 16 | 93.8% | 0.875 | 0.931 | ≥ 80% 통과 |
| primary | 16 | 93.8% | 0.875 | 0.936 | ≥ 70% 통과 |
| insufficient_evidence 여부 | 18 | 100.0% | 1.000 | 1.000 | ≥ 80% 통과 |
| outcome | 18 | 100.0% | 1.000 | 1.000 | 보고 |
| 판정(결과 + primary · multiple 은 한 범주) | 18 | 94.4% | 0.906 | 0.943 | 보고 |
| 판정 전체 정확 일치(multiple 후보 조합까지) | 18 | 94.4% | — | — | 보고 |

연습 10건 점수(blind, 해설 전): —

Gate 1: G1_initial_agreement 17 · G3_major_disagreement 1

## B. 반대검증(Challenger) — reversal 을 종류별로

| 지표 | 값 |
|---|---|
| G1 유지(A2 · B2 제안 모두 1차 합의와 같음) | 16/17 (94.1%) |
| hard reversal(합의안이 죽고 다른 판정만 생존) — 최소 증거 미충족 0 · 증거로 배제 0 · 혼합 0 · 기타 1 | 1/17 (5.9%) C2-02 |
| 원인 아닌 결과와의 충돌(합의안 + insufficient 등 동시 생존) | 0  |
| plausibility expansion(합의안도 충족하지만 다른 후보도 충족 · multiple 로 확장) | 0/17 (0.0%)  |
| insufficient falsification(open-set 사례) | 0/0  |
| 최종 확정 판정이 1차 합의와 다름 · 미해결로 남음 | 0/17 · 0/17 |
| A2 제안 = B2 제안 | 16/18 |
| 같은 모델 재판정(후보 보기 전) A1 = A2p · B1 = B2p | Claude 18/18 · Codex 17/18 |
| evidence adequacy 변화(1차 → 반대검증) | Claude 0 · Codex 0 · 두 모델 같음 1차 17 → 반대검증 17 |
| 반대검증자 차이 | Claude 판정 변경 0 · multiple 0 / Codex 판정 변경 1 · multiple 0 |

공격에 취약한 코드(1차 identified 가 반대검증에서 바뀐 횟수): `R.inference` 1

confidence 는 모델별 보정이 달라(Codex 는 low 0회) 등급 산정에 쓰지 않는다 — 분석 보조 지표.

## C · D · E · F. 4-way · 등급 · 최종

4-way: RED-A_family_conflict 2 · GREEN-A_strong_consensus 14 · RED-C_evidence_insufficient 2

등급: verification_grade_3 1 · verification_grade_4 11 · verification_grade_2 3 · verification_grade_0 2 · verification_grade_1 1

Final adjudication 대상 4 · 최종: FINAL_VERIFIED 17 · UNRESOLVED 1

## G. 반복 충돌 쌍(같은 단계 판정자 간 · 같은 쌍 3사례 이상)

| 쌍 | 사례 | 이전 모델 dry run 에서도(개발 자료 · 합산 안 함) |
|---|---|---|
| (없음) | | |

단계 사이 변화(1차 → 반대검증, 같은 모델): identified:R.inference ↔ identified:V.wrong_sense 1

## H. 기대 판정 비교(봉인 뒤 · 기대는 정답이 아니다)

최종 확정이 기대와 같음 15 · **모델 합의가 기대와 다름 2** · 미해결 중 final 한쪽이 기대와 같음 1

| 사례 | 최종(모델) | 기대 |
|---|---|---|
| C2-02 | identified:R.inference | undetermined (허용 대안에 있음) |
| R4-H1 | identified:R.inference | undetermined |

## I. 코드별 coverage

| 코드 | 노출 사례 | 반대검증에서 검사(X · Y · Z) | contributing(전 단계) | 최종 확정 primary | 미해결에 걸림 |
|---|---|---|---|---|---|
| `V.unknown_word` | 1 | 1 | 0 | 0 | 0 |
| `V.wrong_sense` | 11 | 15 | 0 | 7 | 1 |
| `V.multiword` | 1 | 3 | 0 | 0 | 0 |
| `S.core_structure` | 0 | 1 | 0 | 0 | 0 |
| `S.attachment` | 0 | 0 | 0 | 0 | 0 |
| `S.operator_scope` | 1 | 1 | 0 | 0 | 0 |
| `S.form_rule` | 0 | 0 | 0 | 0 | 0 |
| `R.reference` | 0 | 0 | 0 | 0 | 0 |
| `R.relation` | 5 | 6 | 1 | 0 | 0 |
| `R.main_point` | 4 | 4 | 2 | 0 | 1 |
| `R.inference` | 15 | 15 | 7 | 8 | 1 |
| `E.task_misread` | 0 | 0 | 0 | 0 | 0 |
| `E.evidence_location` | 1 | 1 | 0 | 0 | 0 |
| `E.option_mismatch` | 5 | 6 | 0 | 0 | 1 |
| `B.outside_knowledge` | 2 | 2 | 0 | 0 | 0 |
| `B.surface_match` | 1 | 1 | 0 | 0 | 0 |
| `B.no_verification` | 0 | 1 | 0 | 0 | 0 |
| `X.time` | 0 | 0 | 0 | 0 | 0 |
| `X.attention` | 0 | 0 | 0 | 0 | 0 |

## J. 경계별

| 경계 | n | 1차 일치 | 확정 | 미해결 | 기대와 같음 |
|---|---|---|---|---|---|
| V.wrong_sense ↔ R.inference | 15 | 14 | 14 | 1 | 12 |
| R.inference ↔ V.wrong_sense | 1 | 1 | 1 | 0 | 1 |
| V.wrong_sense ↔ R.relation | 1 | 1 | 1 | 0 | 1 |
| V.wrong_sense ↔ V.unknown_word | 1 | 1 | 1 | 0 | 1 |
| V.wrong_sense ↔ B.surface_match | 1 | 1 | 1 | 0 | 1 |
| R.inference ↔ B.outside_knowledge | 1 | 1 | 1 | 0 | 1 |
| V.multiword ↔ R.inference | 1 | 1 | 1 | 0 | 1 |
| insufficient_evidence ↔ X.time | 1 | 1 | 1 | 0 | 1 |

## 확신도 vs 1차 일치

medium: 14/14 · high: 20/21 · low: 0/1

## 실행 기록(모델 · 버전 · 누출 감사)

| 단계 | CLI | 모델 | 누출 이벤트 |
|---|---|---|---|
| a1/1 | 2.1.289 (Claude Code) | claude-haiku-4-5-20251001, claude-opus-5-5 | 0 |
| a1/2 | 2.1.289 (Claude Code) | claude-haiku-4-5-20251001, claude-opus-5-5 | 0 |
| b1/1 | codex-cli 0.160.0 | gpt-6.1-sol | 0 |
| b1/2 | codex-cli 0.160.0 | gpt-6.1-sol | 0 |
| a2p/1 | 2.1.289 (Claude Code) | claude-haiku-4-5-20251001, claude-opus-5-5 | 0 |
| a2p/2 | 2.1.289 (Claude Code) | claude-haiku-4-5-20251001, claude-opus-5-5 | 0 |
| b2p/1 | codex-cli 0.160.0 | gpt-6.1-sol | 0 |
| b2p/2 | codex-cli 0.160.0 | gpt-6.1-sol | 0 |
| a2/1 | 2.1.289 (Claude Code) | claude-haiku-4-5-20251001, claude-opus-5-5 | 0 |
| a2/2 | 2.1.289 (Claude Code) | claude-haiku-4-5-20251001, claude-opus-5-5 | 0 |
| b2/1 | codex-cli 0.160.0 | gpt-6.1-sol | 0 |
| b2/2 | codex-cli 0.160.0 | gpt-6.1-sol | 0 |
| final-claude/1 | 2.1.289 (Claude Code) | claude-haiku-4-5-20251001, claude-opus-5-5 | 0 |
| final-codex/1 | codex-cli 0.160.0 | gpt-6.1-sol | 0 |

## 사례별(원문 없음)

| 사례 | Gate1 | A1 | B1 | A2 | B2 | 4-way | Final C/X | 최종 | 등급 | 기대 |
|---|---|---|---|---|---|---|---|---|---|---|
| C2-02 | G1 | identified:R.inference | identified:R.inference | identified:R.inference | identified:V.wrong_sense | RED-A | identified:R.inference / identified:R.inference | identified:R.inference | vg3 | undetermined |
| C4-11 | G1 | identified:R.inference | identified:R.inference | identified:R.inference | identified:R.inference | GREEN-A |  /  | identified:R.inference | vg4 | identified:R.inference |
| H-13 | G1 | identified:V.wrong_sense | identified:V.wrong_sense | identified:V.wrong_sense | identified:V.wrong_sense | GREEN-A |  /  | identified:V.wrong_sense | vg4 | identified:V.wrong_sense |
| H-05 | G1 | identified:V.wrong_sense | identified:V.wrong_sense | identified:V.wrong_sense | identified:V.wrong_sense | GREEN-A |  /  | identified:V.wrong_sense | vg4 | identified:V.wrong_sense |
| C4-07 | G1 | identified:R.inference | identified:R.inference | identified:R.inference | identified:R.inference | GREEN-A |  /  | identified:R.inference | vg4 | identified:R.inference |
| R4-H1 | G1 | identified:R.inference | identified:R.inference | identified:R.inference | identified:R.inference | GREEN-A |  /  | identified:R.inference | vg4 | undetermined |
| R4-H2 | G1 | identified:R.inference | identified:R.inference | identified:R.inference | identified:R.inference | GREEN-A |  /  | identified:R.inference | vg4 | identified:R.inference |
| R42-H1 | G1 | identified:V.wrong_sense | identified:V.wrong_sense | identified:V.wrong_sense | identified:V.wrong_sense | GREEN-A |  /  | identified:V.wrong_sense | vg4 | identified:V.wrong_sense |
| R42-H2 | G1 | identified:V.wrong_sense | identified:V.wrong_sense | identified:V.wrong_sense | identified:V.wrong_sense | GREEN-A |  /  | identified:V.wrong_sense | vg2 | identified:V.wrong_sense |
| R42-H3 | G1 | identified:R.inference | identified:R.inference | identified:R.inference | identified:R.inference | GREEN-A |  /  | identified:R.inference | vg4 | identified:R.inference |
| R42-H4 | G1 | identified:R.inference | identified:R.inference | identified:R.inference | identified:R.inference | GREEN-A |  /  | identified:R.inference | vg4 | identified:R.inference |
| R42-H5 | G1 | identified:V.wrong_sense | identified:V.wrong_sense | identified:V.wrong_sense | identified:V.wrong_sense | GREEN-A |  /  | identified:V.wrong_sense | vg4 | identified:V.wrong_sense |
| R42-H6 | G1 | identified:R.inference | identified:R.inference | identified:R.inference | identified:R.inference | GREEN-A |  /  | identified:R.inference | vg4 | identified:R.inference |
| R42-H7 | G1 | insufficient_evidence | insufficient_evidence | insufficient_evidence | insufficient_evidence | RED-C | insufficient_evidence / insufficient_evidence | insufficient_evidence | vg0 | insufficient_evidence |
| R43-HA | G3 | identified:R.inference | identified:V.wrong_sense | identified:R.inference | identified:V.wrong_sense | RED-A | identified:R.inference / identified:V.wrong_sense | UNRESOLVED | vg1 | identified:R.inference |
| R43-HB | G1 | identified:V.wrong_sense | identified:V.wrong_sense | identified:V.wrong_sense | identified:V.wrong_sense | GREEN-A |  /  | identified:V.wrong_sense | vg2 | identified:V.wrong_sense |
| R43-HC | G1 | identified:V.wrong_sense | identified:V.wrong_sense | identified:V.wrong_sense | identified:V.wrong_sense | GREEN-A |  /  | identified:V.wrong_sense | vg2 | identified:V.wrong_sense |
| R43-HD | G1 | insufficient_evidence | insufficient_evidence | insufficient_evidence | insufficient_evidence | RED-C | insufficient_evidence / insufficient_evidence | insufficient_evidence | vg0 | insufficient_evidence |
