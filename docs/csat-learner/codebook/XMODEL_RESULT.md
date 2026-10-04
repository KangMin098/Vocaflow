# Cross-Model Blind Dry Run 결과 — xm-20261004

> Claude Code × Codex 4중 교차검증. **사람 판정이 아니다** — 이 수치는 cross-model agreement 이며 human reliability · 사람 검증이 아니다. 원문 · 판정 원본은 저장소 밖 실행 폴더에만 있다.

코드북 rev3 `d19e04e8c70e` · 최종 판정 봉인 `830ee7004b19` · 사례 56

## A. 1차(A1 Claude ↔ B1 Codex) cross-model 일치

| 지표 | n | 일치 | κ | AC1 | 내부 screening |
|---|---|---|---|---|---|
| family | 48 | 97.9% | 0.973 | 0.975 | ≥ 80% 통과 |
| primary | 48 | 89.6% | 0.887 | 0.890 | ≥ 70% 통과 |
| insufficient_evidence 여부 | 56 | 96.4% | 0.732 | 0.959 | ≥ 80% 통과 |
| outcome | 56 | 96.4% | 0.853 | 0.962 | 보고 |
| 판정(결과 + primary · multiple 은 한 범주) | 56 | 87.5% | 0.867 | 0.869 | 보고 |
| 판정 전체 정확 일치(multiple 후보 조합까지) | 56 | 87.5% | — | — | 보고 |

연습 10건 점수(blind, 해설 전): train-a 10/10 · train-b 10/10

Gate 1: G1_initial_agreement 49 · G2_boundary_disagreement 4 · G4_outcome_disagreement 2 · G3_major_disagreement 1

## B. 반대검증(Challenger) — reversal 을 종류별로

| 지표 | 값 |
|---|---|
| G1 유지(A2 · B2 제안 모두 1차 합의와 같음) | 41/49 (83.7%) |
| hard reversal(합의안이 죽고 다른 판정만 생존) — 최소 증거 미충족 3 · 증거로 배제 1 · 혼합 0 · 기타 2 | 6/47 (12.8%) C2-02 C2-08 H-14 C3-17 N-02 C1-19 |
| 원인 아닌 결과와의 충돌(합의안 + insufficient 등 동시 생존) | 0  |
| plausibility expansion(합의안도 충족하지만 다른 후보도 충족 · multiple 로 확장) | 0/47 (0.0%)  |
| insufficient falsification(open-set 사례) | 0/2  |
| 최종 확정 판정이 1차 합의와 다름 · 미해결로 남음 | 0/49 · 5/49 |
| A2 제안 = B2 제안 | 43/56 |
| 같은 모델 재판정(후보 보기 전) A1 = A2p · B1 = B2p | Claude 51/56 · Codex 50/56 |
| evidence adequacy 변화(1차 → 반대검증) | Claude 11 · Codex 11 · 두 모델 같음 1차 45 → 반대검증 49 |
| 반대검증자 차이 | Claude 판정 변경 6 · multiple 2 / Codex 판정 변경 9 · multiple 2 |

공격에 취약한 코드(1차 identified 가 반대검증에서 바뀐 횟수): `R.relation` 3 · `R.inference` 2 · `V.wrong_sense` 2 · `B.outside_knowledge` 2 · `R.reference` 1 · `V.multiword` 1 · `S.core_structure` 1 · `S.operator_scope` 1 · `E.evidence_location` 1

confidence 는 모델별 보정이 달라(Codex 는 low 0회) 등급 산정에 쓰지 않는다 — 분석 보조 지표.

## C · D · E · F. 4-way · 등급 · 최종

4-way: RED-A_family_conflict 5 · GREEN-A_strong_consensus 41 · RED-C_evidence_insufficient 4 · RED-B_evidence_conflict 2 · YELLOW-B_same_family_boundary 2 · GREEN-B_independent_convergence 1 · YELLOW-A_unresolved_objection 1

등급: verification_grade_1 8 · verification_grade_4 29 · verification_grade_3 4 · verification_grade_2 12 · verification_grade_0 3

Final adjudication 대상 14 · 최종: UNRESOLVED 8 · FINAL_VERIFIED 48

## G. 반복 충돌 쌍(같은 단계 판정자 간 · 같은 쌍 3사례 이상)

| 쌍 | 사례 | 이전 모델 dry run 에서도(개발 자료 · 합산 안 함) |
|---|---|---|
| (없음) | | |

단계 사이 변화(1차 → 반대검증, 같은 모델): identified:B.outside_knowledge ↔ identified:R.relation 3 · identified:R.inference ↔ identified:V.wrong_sense 1 · identified:R.reference ↔ insufficient_evidence 1 · identified:R.relation ↔ multiple_plausible:R.inference\|R.relation 1 · identified:R.inference ↔ multiple_plausible:R.inference\|R.main_point 1 · identified:R.inference ↔ identified:V.multiword 1 · identified:R.main_point ↔ identified:V.wrong_sense 1 · identified:R.relation ↔ identified:S.operator_scope 1 · identified:R.main_point ↔ identified:S.core_structure 1 · identified:V.wrong_sense ↔ multiple_plausible:V.multiword\|V.wrong_sense 1 · identified:S.operator_scope ↔ insufficient_evidence 1 · identified:R.inference ↔ insufficient_evidence 1 · identified:E.evidence_location ↔ insufficient_evidence 1

## H. 기대 판정 비교(봉인 뒤 · 기대는 정답이 아니다)

최종 확정이 기대와 같음 30 · **모델 합의가 기대와 다름 18** · 미해결 중 final 한쪽이 기대와 같음 4

| 사례 | 최종(모델) | 기대 |
|---|---|---|
| C4-11 | identified:R.inference | identified:V.wrong_sense (허용 대안에 있음) |
| H-13 | identified:V.wrong_sense | identified:R.inference |
| H-15 | identified:R.relation | identified:R.reference (허용 대안에 있음) |
| C2-08 | identified:R.relation | identified:B.outside_knowledge (허용 대안에 있음) |
| C2-09 | identified:R.inference | identified:S.operator_scope |
| C4-02 | identified:R.relation | identified:B.surface_match |
| C3-01 | identified:E.task_misread | identified:X.attention (허용 대안에 있음) |
| H-09 | identified:R.inference | multiple_plausible:B.no_verification\|X.time |
| H-19 | inconsistent_evidence | identified:S.operator_scope |
| N-13 | identified:V.multiword | multiple_plausible:S.core_structure\|V.unknown_word |
| N-14 | identified:R.main_point | multiple_plausible:S.core_structure\|V.wrong_sense |
| H-04 | identified:R.relation | multiple_plausible:R.relation\|S.core_structure |
| N-12 | identified:R.inference | inconsistent_evidence |
| C1-08 | inconsistent_evidence | identified:R.relation |
| N-01 | identified:S.operator_scope | identified:S.attachment |
| N-02 | identified:S.core_structure | identified:S.attachment |
| N-04 | multiple_plausible:V.multiword\|V.wrong_sense | identified:V.multiword |
| N-09 | insufficient_evidence | identified:E.option_mismatch |

## I. 코드별 coverage

| 코드 | 노출 사례 | 반대검증에서 검사(X · Y · Z) | contributing(전 단계) | 최종 확정 primary | 미해결에 걸림 |
|---|---|---|---|---|---|
| `V.unknown_word` | 5 | 9 | 0 | 1 | 2 |
| `V.wrong_sense` | 9 | 12 | 0 | 2 | 4 |
| `V.multiword` | 6 | 9 | 1 | 1 | 2 |
| `S.core_structure` | 7 | 9 | 0 | 4 | 1 |
| `S.attachment` | 2 | 3 | 0 | 1 | 0 |
| `S.operator_scope` | 3 | 4 | 0 | 2 | 1 |
| `S.form_rule` | 4 | 5 | 1 | 2 | 0 |
| `R.reference` | 3 | 7 | 0 | 2 | 1 |
| `R.relation` | 14 | 17 | 1 | 5 | 1 |
| `R.main_point` | 12 | 14 | 6 | 2 | 3 |
| `R.inference` | 11 | 11 | 4 | 6 | 3 |
| `E.task_misread` | 3 | 4 | 0 | 3 | 0 |
| `E.evidence_location` | 5 | 5 | 0 | 3 | 2 |
| `E.option_mismatch` | 5 | 9 | 0 | 2 | 0 |
| `B.outside_knowledge` | 2 | 2 | 2 | 1 | 0 |
| `B.surface_match` | 8 | 8 | 4 | 1 | 1 |
| `B.no_verification` | 4 | 2 | 4 | 0 | 0 |
| `X.time` | 6 | 7 | 3 | 1 | 1 |
| `X.attention` | 4 | 7 | 0 | 2 | 1 |

## J. 경계별

| 경계 | n | 1차 일치 | 확정 | 미해결 | 기대와 같음 |
|---|---|---|---|---|---|
| 감시: 저빈도 E | 7 | 7 | 6 | 1 | 5 |
| V.wrong_sense ↔ R.inference | 5 | 5 | 4 | 1 | 2 |
| R ↔ B | 5 | 4 | 5 | 0 | 2 |
| identified ↔ multiple_plausible | 5 | 4 | 2 | 3 | 0 |
| 안정 코드 대표 | 5 | 5 | 5 | 0 | 5 |
| R.reference ↔ R.relation | 4 | 4 | 3 | 1 | 2 |
| S.form_rule ↔ 다른 S | 4 | 3 | 4 | 0 | 4 |
| multiple_plausible ↔ insufficient_evidence | 4 | 3 | 3 | 1 | 0 |
| inconsistent_evidence | 4 | 4 | 4 | 0 | 2 |
| E.task_misread ↔ X.time | 3 | 3 | 3 | 0 | 2 |
| E.task_misread ↔ X.attention | 3 | 3 | 3 | 0 | 3 |
| 감시: S.attachment | 3 | 2 | 3 | 0 | 1 |
| 감시: V.multiword | 2 | 0 | 1 | 1 | 0 |
| A0 · A1 | 2 | 2 | 2 | 0 | 2 |

## 확신도 vs 1차 일치

medium: 32/41 · high: 55/55 · low: 11/16

## 실행 기록(모델 · 버전 · 누출 감사)

| 단계 | CLI | 모델 | 누출 이벤트 |
|---|---|---|---|
| train-a/1 | 2.1.289 (Claude Code) | claude-haiku-4-5-20251001, claude-opus-5-5 | 0 |
| train-b/1 | codex-cli 0.160.0 | gpt-6.1-sol | 0 |
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
| C2-02 | G1 | identified:R.inference | identified:R.inference | identified:R.inference | identified:V.wrong_sense | RED-A | identified:R.inference / identified:V.wrong_sense | UNRESOLVED | vg1 | identified:R.inference |
| C4-11 | G1 | identified:R.inference | identified:R.inference | identified:R.inference | identified:R.inference | GREEN-A |  /  | identified:R.inference | vg4 | identified:V.wrong_sense |
| H-13 | G1 | identified:V.wrong_sense | identified:V.wrong_sense | identified:V.wrong_sense | identified:V.wrong_sense | GREEN-A |  /  | identified:V.wrong_sense | vg4 | identified:R.inference |
| H-05 | G1 | identified:V.wrong_sense | identified:V.wrong_sense | identified:V.wrong_sense | identified:V.wrong_sense | GREEN-A |  /  | identified:V.wrong_sense | vg4 | identified:V.wrong_sense |
| C4-07 | G1 | identified:R.inference | identified:R.inference | identified:R.inference | identified:R.inference | GREEN-A |  /  | identified:R.inference | vg4 | identified:R.inference |
| C3-15 | G1 | identified:R.reference | identified:R.reference | identified:R.reference | insufficient_evidence | RED-C | identified:R.reference / insufficient_evidence | UNRESOLVED | vg1 | identified:R.relation |
| H-15 | G1 | identified:R.relation | identified:R.relation | identified:R.relation | identified:R.relation | GREEN-A |  /  | identified:R.relation | vg4 | identified:R.reference |
| C2-14 | G1 | identified:R.reference | identified:R.reference | identified:R.reference | identified:R.reference | GREEN-A |  /  | identified:R.reference | vg4 | identified:R.reference |
| C1-03 | G1 | identified:R.reference | identified:R.reference | identified:R.reference | identified:R.reference | GREEN-A |  /  | identified:R.reference | vg4 | identified:R.reference |
| C2-08 | G1 | identified:R.relation | identified:R.relation | identified:B.outside_knowledge | identified:R.relation | RED-A | identified:R.relation / identified:R.relation | identified:R.relation | vg3 | identified:B.outside_knowledge |
| C2-09 | G2 | identified:R.relation | identified:R.inference | multiple_plausible:R.inference\|R.relation | multiple_plausible:R.inference\|R.main_point | RED-B | identified:R.inference / identified:R.inference | identified:R.inference | vg2 | identified:S.operator_scope |
| C3-08 | G1 | identified:R.relation | identified:R.relation | identified:R.relation | identified:R.relation | GREEN-A |  /  | identified:R.relation | vg4 | identified:R.relation |
| H-16 | G1 | identified:B.surface_match | identified:B.surface_match | identified:B.surface_match | identified:B.surface_match | GREEN-A |  /  | identified:B.surface_match | vg4 | identified:B.surface_match |
| C4-02 | G1 | identified:R.relation | identified:R.relation | identified:R.relation | identified:R.relation | GREEN-A |  /  | identified:R.relation | vg4 | identified:B.surface_match |
| C3-01 | G1 | identified:E.task_misread | identified:E.task_misread | identified:E.task_misread | identified:E.task_misread | GREEN-A |  /  | identified:E.task_misread | vg2 | identified:X.attention |
| H-11 | G1 | identified:E.task_misread | identified:E.task_misread | identified:E.task_misread | identified:E.task_misread | GREEN-A |  /  | identified:E.task_misread | vg4 | identified:E.task_misread |
| H-10 | G1 | identified:X.time | identified:X.time | identified:X.time | identified:X.time | GREEN-A |  /  | identified:X.time | vg4 | identified:X.time |
| H-12 | G1 | identified:X.attention | identified:X.attention | identified:X.attention | identified:X.attention | GREEN-A |  /  | identified:X.attention | vg2 | identified:X.attention |
| C1-17 | G1 | identified:X.attention | identified:X.attention | identified:X.attention | identified:X.attention | GREEN-A |  /  | identified:X.attention | vg2 | identified:X.attention |
| C2-04 | G1 | identified:E.task_misread | identified:E.task_misread | identified:E.task_misread | identified:E.task_misread | GREEN-A |  /  | identified:E.task_misread | vg4 | identified:E.task_misread |
| H-21 | G1 | identified:S.core_structure | identified:S.core_structure | identified:S.core_structure | identified:S.core_structure | GREEN-A |  /  | identified:S.core_structure | vg4 | identified:S.core_structure |
| H-22 | G1 | identified:S.form_rule | identified:S.form_rule | identified:S.form_rule | identified:S.form_rule | GREEN-A |  /  | identified:S.form_rule | vg4 | identified:S.form_rule |
| C2-11 | G2 | identified:S.core_structure | identified:S.form_rule | identified:S.core_structure | identified:S.form_rule | YELLOW-B | identified:S.core_structure / identified:S.core_structure | identified:S.core_structure | vg3 | identified:S.core_structure |
| C3-11 | G1 | identified:S.form_rule | identified:S.form_rule | identified:S.form_rule | identified:S.form_rule | GREEN-A |  /  | identified:S.form_rule | vg2 | identified:S.form_rule |
| H-09 | G1 | identified:R.inference | identified:R.inference | identified:R.inference | identified:R.inference | GREEN-A |  /  | identified:R.inference | vg2 | multiple_plausible:B.no_verification\|X.time |
| H-14 | G1 | identified:V.multiword | identified:V.multiword | identified:R.inference | identified:V.multiword | RED-A | identified:R.inference / identified:V.multiword | UNRESOLVED | vg1 | identified:V.multiword |
| H-17 | G2 | identified:V.unknown_word | identified:V.wrong_sense | identified:V.unknown_word | identified:V.wrong_sense | YELLOW-B | identified:V.unknown_word / identified:V.wrong_sense | UNRESOLVED | vg1 | identified:V.unknown_word |
| H-19 | G1 | inconsistent_evidence | inconsistent_evidence | inconsistent_evidence | inconsistent_evidence | GREEN-A |  /  | inconsistent_evidence | vg2 | identified:S.operator_scope |
| C3-17 | G1 | identified:V.wrong_sense | identified:V.wrong_sense | identified:V.wrong_sense | identified:R.main_point | RED-A | identified:V.wrong_sense / identified:R.main_point | UNRESOLVED | vg1 | multiple_plausible:B.surface_match\|V.wrong_sense |
| N-13 | G1 | identified:V.multiword | identified:V.multiword | identified:V.multiword | identified:V.multiword | GREEN-A |  /  | identified:V.multiword | vg4 | multiple_plausible:S.core_structure\|V.unknown_word |
| N-14 | G1 | identified:R.main_point | identified:R.main_point | identified:R.main_point | identified:R.main_point | GREEN-A |  /  | identified:R.main_point | vg4 | multiple_plausible:S.core_structure\|V.wrong_sense |
| N-15 | G4 | multiple_plausible:S.core_structure\|V.unknown_word | insufficient_evidence | multiple_plausible:S.core_structure\|V.unknown_word | insufficient_evidence | RED-C | multiple_plausible:S.core_structure\|V.unknown_word / insufficient_evidence | UNRESOLVED | vg1 | insufficient_evidence |
| H-04 | G1 | identified:R.relation | identified:R.relation | identified:R.relation | identified:R.relation | GREEN-A |  /  | identified:R.relation | vg2 | multiple_plausible:R.relation\|S.core_structure |
| N-11 | G1 | inconsistent_evidence | inconsistent_evidence | inconsistent_evidence | inconsistent_evidence | GREEN-A |  /  | inconsistent_evidence | vg2 | inconsistent_evidence |
| N-12 | G1 | identified:R.inference | identified:R.inference | identified:R.inference | identified:R.inference | GREEN-A |  /  | identified:R.inference | vg4 | inconsistent_evidence |
| C1-08 | G1 | inconsistent_evidence | inconsistent_evidence | inconsistent_evidence | inconsistent_evidence | GREEN-A |  /  | inconsistent_evidence | vg2 | identified:R.relation |
| C4-12 | G1 | identified:R.inference | identified:R.inference | identified:R.inference | identified:R.inference | GREEN-A |  /  | identified:R.inference | vg4 | identified:R.inference |
| N-01 | G3 | identified:S.operator_scope | identified:R.relation | identified:S.operator_scope | identified:S.operator_scope | GREEN-B |  /  | identified:S.operator_scope | vg2 | identified:S.attachment |
| N-02 | G1 | identified:S.core_structure | identified:S.core_structure | identified:R.main_point | identified:S.core_structure | RED-A | identified:S.core_structure / identified:S.core_structure | identified:S.core_structure | vg3 | identified:S.attachment |
| N-03 | G1 | identified:S.attachment | identified:S.attachment | identified:S.attachment | identified:S.attachment | GREEN-A |  /  | identified:S.attachment | vg4 | identified:S.attachment |
| N-04 | G2 | identified:V.multiword | identified:V.wrong_sense | identified:V.multiword | multiple_plausible:V.multiword\|V.wrong_sense | RED-B | multiple_plausible:V.multiword\|V.wrong_sense / multiple_plausible:V.multiword\|V.wrong_sense | multiple_plausible:V.multiword\|V.wrong_sense | vg2 | identified:V.multiword |
| N-05 | G4 | identified:S.operator_scope | insufficient_evidence | insufficient_evidence | identified:R.inference | RED-C | insufficient_evidence / identified:R.inference | UNRESOLVED | vg1 | identified:V.multiword |
| N-06 | G1 | identified:E.evidence_location | identified:E.evidence_location | identified:E.evidence_location | identified:E.evidence_location | GREEN-A |  /  | identified:E.evidence_location | vg4 | identified:E.evidence_location |
| N-07 | G1 | identified:E.evidence_location | identified:E.evidence_location | identified:E.evidence_location | identified:E.evidence_location | GREEN-A |  /  | identified:E.evidence_location | vg4 | identified:E.evidence_location |
| N-08 | G1 | identified:E.option_mismatch | identified:E.option_mismatch | identified:E.option_mismatch | identified:E.option_mismatch | GREEN-A |  /  | identified:E.option_mismatch | vg4 | identified:E.option_mismatch |
| N-09 | G1 | insufficient_evidence | insufficient_evidence | insufficient_evidence | insufficient_evidence | GREEN-A |  /  | insufficient_evidence | vg0 | identified:E.option_mismatch |
| N-10 | G1 | identified:E.option_mismatch | identified:E.option_mismatch | identified:E.option_mismatch | identified:E.option_mismatch | GREEN-A |  /  | identified:E.option_mismatch | vg4 | identified:E.option_mismatch |
| H-23 | G1 | identified:E.evidence_location | identified:E.evidence_location | identified:E.evidence_location | identified:E.evidence_location | GREEN-A |  /  | identified:E.evidence_location | vg4 | identified:E.evidence_location |
| H-24 | G1 | identified:E.evidence_location | identified:E.evidence_location | identified:E.evidence_location | insufficient_evidence | RED-C | identified:E.evidence_location / insufficient_evidence | UNRESOLVED | vg1 | identified:E.option_mismatch |
| C1-13 | G1 | identified:S.operator_scope | identified:S.operator_scope | identified:S.operator_scope | identified:S.operator_scope | GREEN-A |  /  | identified:S.operator_scope | vg4 | identified:S.operator_scope |
| C4-08 | G1 | identified:V.unknown_word | identified:V.unknown_word | identified:V.unknown_word | identified:V.unknown_word | GREEN-A |  /  | identified:V.unknown_word | vg4 | identified:V.unknown_word |
| C1-19 | G1 | identified:B.outside_knowledge | identified:B.outside_knowledge | identified:R.relation | identified:R.relation | YELLOW-A | identified:B.outside_knowledge / identified:B.outside_knowledge | identified:B.outside_knowledge | vg3 | identified:B.outside_knowledge |
| C1-09 | G1 | identified:R.main_point | identified:R.main_point | identified:R.main_point | identified:R.main_point | GREEN-A |  /  | identified:R.main_point | vg4 | identified:R.main_point |
| C3-07 | G1 | identified:S.core_structure | identified:S.core_structure | identified:S.core_structure | identified:S.core_structure | GREEN-A |  /  | identified:S.core_structure | vg4 | identified:S.core_structure |
| C1-11 | G1 | insufficient_evidence | insufficient_evidence | insufficient_evidence | insufficient_evidence | GREEN-A |  /  | insufficient_evidence | vg0 | insufficient_evidence |
| C3-10 | G1 | insufficient_evidence | insufficient_evidence | insufficient_evidence | insufficient_evidence | GREEN-A |  /  | insufficient_evidence | vg0 | insufficient_evidence |
