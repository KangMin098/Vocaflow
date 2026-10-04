# Cross-Model Dry Run adjudication 결과 — xm-20261004-adj

> 사전 등록: [ADJUDICATION_PLAN.md](./ADJUDICATION_PLAN.md) (커밋 `a6e4670e4`) · 판정자 Claude · Codex(새 context, 2단계) · 사람 판정 아님 · 원문 없음.

대상 26건(모델-기대 불일치 18 · 미해결 8) · 두 판정자 주 코드 일치 20 · 불일치 6

## 코드 분포

| 코드 | Claude | Codex | 두 판정자 합의 |
|---|---|---|---|
| `GOLD_WRONG` | 16 | 17 | 15 |
| `GOLD_UNDERSPECIFIED` | 0 | 0 | 0 |
| `ITEM_AMBIGUOUS` | 0 | 0 | 0 |
| `ITEM_BAD_CONSTRUCT` | 2 | 4 | 2 |
| `CODEBOOK_BOUNDARY_WEAK` | 7 | 4 | 3 |
| `CODE_REDUNDANT` | 1 | 0 | 0 |
| `MODEL_SHARED_BIAS` | 0 | 1 | 0 |
| `INSUFFICIENT_EVIDENCE` | 0 | 0 | 0 |

## rev4 조건(사전 등록 — 합의 사례만)

1. 같은 경계 CODEBOOK_BOUNDARY_WEAK ≥ 2: 없음
2. identified ↔ multiple_plausible 반복(≥ 2): 없음
3. S.attachment 분리 안 됨: 없음
4. 흔들린 4코드 규칙 문제(≥ 2): C2-02 N-04

**rev4 필요: 예** · GOLD 쪽(GOLD_WRONG · GOLD_UNDERSPECIFIED · ITEM_BAD_CONSTRUCT) 과반: 예

## v0.1 seed 후보 조건(사전 등록)

- 미충족 — c1_unresolved_zero_or_excluded: 미해결 8건 · 사유 있는 명시적 제외 0 · 남음 C2-02 C3-15 H-14 H-17 C3-17 N-15 N-05 H-24
- 미충족 — c2_no_repeated_rule_failure: rev4 조건 충족
- 충족 — c3_shared_bias_le_25pct: MODEL_SHARED_BIAS(두 판정자 합의) 0/18
- 미충족 — c4_im_boundary_reproducible: 그 경계 사례 5건 중 합의 · 규칙 약함 아님 3
- 충족 — c5_gold_accept_schema: 허용 대안이 필요한 기대 판정 없음
- 미충족 — c6_subset_rerun_if_rev4: rev4 후 바뀐 경계 subset 재-blind-run 필요

**seed 후보: 아니오**

## 사례별

| 사례 | 종류 | 회차 최종 | 기대 | 1단계 A / B (기대 지지) | 코드 Claude / Codex | 경계 | 권장 기대 A / B | 코드북 문제 제기 A / B |
|---|---|---|---|---|---|---|---|---|
| C2-02 | 미해결 | — | identified:R.inference | identified:R.inference (yes) / identified:V.wrong_sense (partial) | CODEBOOK_BOUNDARY_WEAK / CODEBOOK_BOUNDARY_WEAK | R.inference ↔ V.wrong_sense | identified:R.inference / identified:V.wrong_sense | 예 / 예 |
| C4-11 | 불일치 | identified:R.inference | identified:V.wrong_sense | identified:R.inference (partial) / identified:R.inference (partial) | GOLD_WRONG / GOLD_WRONG | R.inference ↔ V.wrong_sense | identified:R.inference / identified:R.inference | 예 / — |
| H-13 | 불일치 | identified:V.wrong_sense | identified:R.inference | identified:V.wrong_sense (no) / identified:V.wrong_sense (no) | GOLD_WRONG / GOLD_WRONG | R.inference ↔ V.wrong_sense | identified:V.wrong_sense / identified:V.wrong_sense | — / — |
| C3-15 | 미해결 | — | identified:R.relation | identified:R.reference (partial) / insufficient_evidence (no) | GOLD_WRONG / CODEBOOK_BOUNDARY_WEAK | R.reference ↔ R.relation | identified:R.reference / insufficient_evidence | 예 / 예 |
| H-15 | 불일치 | identified:R.relation | identified:R.reference | identified:R.reference (yes) / identified:R.relation (partial) | GOLD_WRONG / GOLD_WRONG | R.reference ↔ R.relation | identified:R.relation / identified:R.relation | — / — |
| C2-08 | 불일치 | identified:R.relation | identified:B.outside_knowledge | identified:B.outside_knowledge (yes) / identified:B.outside_knowledge (yes) | CODEBOOK_BOUNDARY_WEAK / GOLD_WRONG | B.outside_knowledge ↔ R.relation | identified:R.relation / identified:R.relation | 예 / — |
| C2-09 | 불일치 | identified:R.inference | identified:S.operator_scope | identified:S.operator_scope (partial) / identified:R.inference (no) | GOLD_WRONG / GOLD_WRONG | B.surface_match ↔ R.inference ↔ R.relation ↔ S.operator_scope | identified:R.inference / identified:R.inference | — / — |
| C4-02 | 불일치 | identified:R.relation | identified:B.surface_match | identified:R.relation (partial) / identified:R.relation (no) | GOLD_WRONG / GOLD_WRONG | B.surface_match ↔ R.relation | identified:R.relation / identified:R.relation | — / — |
| C3-01 | 불일치 | identified:E.task_misread | identified:X.attention | identified:E.task_misread (partial) / identified:E.task_misread (partial) | GOLD_WRONG / GOLD_WRONG | E.task_misread ↔ X.attention | identified:E.task_misread / identified:E.task_misread | — / — |
| H-09 | 불일치 | identified:R.inference | multiple_plausible: | identified:R.main_point (no) / identified:R.inference (no) | GOLD_WRONG / GOLD_WRONG | B.no_verification ↔ R.inference ↔ X.time | identified:R.inference / identified:R.inference | — / — |
| H-14 | 미해결 | — | identified:V.multiword | identified:V.multiword (yes) / identified:V.multiword (yes) | CODEBOOK_BOUNDARY_WEAK / MODEL_SHARED_BIAS | R.inference ↔ V.multiword | identified:V.multiword / identified:V.multiword | 예 / — |
| H-17 | 미해결 | — | identified:V.unknown_word | identified:V.unknown_word (yes) / identified:V.wrong_sense (partial) | CODEBOOK_BOUNDARY_WEAK / GOLD_WRONG | V.unknown_word ↔ V.wrong_sense | identified:V.unknown_word / identified:V.wrong_sense | 예 / — |
| H-19 | 불일치 | inconsistent_evidence | identified:S.operator_scope | identified:R.relation (partial) / inconsistent_evidence (no) | GOLD_WRONG / GOLD_WRONG | identified ↔ inconsistent_evidence | inconsistent_evidence / inconsistent_evidence | 예 / — |
| C3-17 | 미해결 | — | multiple_plausible: | identified:V.wrong_sense (no) / identified:V.wrong_sense (no) | GOLD_WRONG / GOLD_WRONG | B.surface_match ↔ R.main_point ↔ V.wrong_sense | identified:V.wrong_sense / identified:R.main_point | — / — |
| N-13 | 불일치 | identified:V.multiword | multiple_plausible: | multiple_plausible:V.multiword\|V.wrong_sense (partial) / identified:V.multiword (no) | GOLD_WRONG / GOLD_WRONG | V.multiword ↔ V.wrong_sense | identified:V.multiword / identified:V.multiword | 예 / — |
| N-14 | 불일치 | identified:R.main_point | multiple_plausible: | multiple_plausible:S.core_structure\|V.wrong_sense (yes) / identified:R.main_point (no) | GOLD_WRONG / GOLD_WRONG | R.main_point ↔ multiple_plausible | identified:R.main_point / identified:R.main_point | — / — |
| N-15 | 미해결 | — | insufficient_evidence | insufficient_evidence (yes) / insufficient_evidence (yes) | CODEBOOK_BOUNDARY_WEAK / CODEBOOK_BOUNDARY_WEAK | insufficient_evidence ↔ multiple_plausible | insufficient_evidence / insufficient_evidence | 예 / 예 |
| H-04 | 불일치 | identified:R.relation | multiple_plausible: | identified:R.relation (no) / identified:R.relation (no) | GOLD_WRONG / GOLD_WRONG | identified ↔ multiple_plausible | identified:R.relation / identified:R.relation | — / — |
| N-12 | 불일치 | identified:R.inference | inconsistent_evidence | identified:R.inference (no) / identified:R.inference (no) | GOLD_WRONG / GOLD_WRONG | R.inference ↔ inconsistent_evidence | identified:R.inference / identified:R.inference | — / — |
| C1-08 | 불일치 | inconsistent_evidence | identified:R.relation | inconsistent_evidence (no) / inconsistent_evidence (no) | GOLD_WRONG / GOLD_WRONG | R.relation ↔ inconsistent_evidence | inconsistent_evidence / inconsistent_evidence | — / — |
| N-01 | 불일치 | identified:S.operator_scope | identified:S.attachment | insufficient_evidence (no) / identified:S.attachment (yes) | ITEM_BAD_CONSTRUCT / ITEM_BAD_CONSTRUCT | R.relation ↔ S.attachment ↔ S.operator_scope | insufficient_evidence / identified:S.operator_scope | 예 / — |
| N-02 | 불일치 | identified:S.core_structure | identified:S.attachment | multiple_plausible:S.attachment\|S.core_structure (partial) / identified:S.core_structure (no) | CODE_REDUNDANT / ITEM_BAD_CONSTRUCT | S.attachment ↔ S.core_structure | identified:S.core_structure / identified:S.core_structure | 예 / — |
| N-04 | 불일치 | multiple_plausible:V.multiword\|V.wrong_sense | identified:V.multiword | identified:V.multiword (yes) / identified:V.multiword (yes) | CODEBOOK_BOUNDARY_WEAK / CODEBOOK_BOUNDARY_WEAK | V.multiword ↔ V.wrong_sense | identified:V.multiword / multiple_plausible:V.multiword\|V.wrong_sense | 예 / 예 |
| N-05 | 미해결 | — | identified:V.multiword | multiple_plausible:S.operator_scope\|V.multiword (partial) / insufficient_evidence (no) | ITEM_BAD_CONSTRUCT / ITEM_BAD_CONSTRUCT | S.operator_scope ↔ V.multiword ↔ insufficient_evidence | insufficient_evidence / insufficient_evidence | — / — |
| N-09 | 불일치 | insufficient_evidence | identified:E.option_mismatch | identified:E.option_mismatch (yes) / insufficient_evidence (no) | GOLD_WRONG / GOLD_WRONG | E.option_mismatch ↔ insufficient_evidence | insufficient_evidence / insufficient_evidence | — / — |
| H-24 | 미해결 | — | identified:E.option_mismatch | identified:E.evidence_location (partial) / insufficient_evidence (no) | CODEBOOK_BOUNDARY_WEAK / ITEM_BAD_CONSTRUCT | E.evidence_location ↔ E.option_mismatch ↔ insufficient_evidence | identified:E.evidence_location / insufficient_evidence | 예 / — |

판정자 서술(코드북 문제 · 근거) 전문은 저장소 밖 실행 폴더 `operator/adjudication-full.json` 에만 있다.
