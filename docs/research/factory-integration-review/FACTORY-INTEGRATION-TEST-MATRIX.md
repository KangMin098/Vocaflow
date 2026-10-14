# PR264 — 독립 수용 시험 행렬

2026-10-15. 원본19개 통과는 그대로 보존했다. 신규82개 Vitest 통과는 진단 실행과 봉인된 출력 재현을 뜻하며 계약 안전성 PASS가 아니다. 신규 기대조건:42 PASS·40 FAIL. 실제 공장/납품/학생/DB 실행0.

| 검증 | 신규 사례 | 기대조건 PASS | FAIL | 판정 |
|---|---:|---:|---:|---|
| A | 21 | 4 | 17 | FAIL |
| B | 8 | 5 | 3 | FAIL |
| C | 11 | 1 | 10 | FAIL |
| D | 14 | 9 | 5 | FAIL |
| E | 14 | 12 | 2 | FAIL |
| F | 6 | 6 | 0 | PASS(현행 단위 표현) |
| G | 4 | 2 | 2 | FAIL |
| H | 4 | 3 | 1 | FAIL | 

C의 양성 대조는 upstream이 검증했다는 합성 전제만 확인하며 실제 R5 공급 승인0이다. D의 approvalState 철회/다른자격 필터와 deliveryCheck 노출 차단은 통과하지만, 서버 원장의 권한/진정성을 검증하지는 않는다. F의 convertible_to_volume은 권 공정 유형 대응이며 활동 생산 승인/자동API가 아니다. H는 NeedRank/ActionRank 구조를 정적 확인했고 재고0에서도 수요 유지/계획량 분리 검사를 실행했다. 학생 교육 효과를 평가하지 않았다.

| ID | 기대 | 실제 진단 | 관련 결함 |
|---|---|---|---|
| A-status-spec_created | Nonusable or contradictory state must supply0 | FAIL | I01 |
| A-status-order_received | Nonusable or contradictory state must supply0 | FAIL | I01 |
| A-status-awaiting_production | Nonusable or contradictory state must supply0 | FAIL | I01 |
| A-status-failed | Nonusable or contradictory state must supply0 | FAIL | I01 |
| A-status-review_failed | Nonusable or contradictory state must supply0 | FAIL | I01 |
| A-status-review_pending | Nonusable or contradictory state must supply0 | FAIL | I01 |
| A-status-unsupported | Nonusable or contradictory state must supply0 | FAIL | I01 |
| A-status-UNKNOWN_STATUS | Nonusable or contradictory state must supply0 | FAIL | I01 |
| A-missing_run | Malformed/contradictory manifest must supply0 | PASS | — |
| A-artifact_run_mismatch | Malformed/contradictory manifest must supply0 | FAIL | I03 |
| A-role_mismatch | Malformed/contradictory manifest must supply0 | FAIL | I04 |
| A-duplicate | Malformed/contradictory manifest must supply0 | FAIL | I02 |
| A-mixed_revision | Malformed/contradictory manifest must supply0 | FAIL | I02 |
| A-count_mismatch | Malformed/contradictory manifest must supply0 | PASS | — |
| A-unknown_kind | Malformed/contradictory manifest must supply0 | PASS | — |
| A-unknown_type | Malformed/contradictory manifest must supply0 | FAIL | I01 |
| A-unknown_mode | Malformed/contradictory manifest must supply0 | FAIL | I01 |
| A-missing_failure_reason | Malformed/contradictory manifest must supply0 | FAIL | I01 |
| A-empty_id | Malformed/contradictory manifest must supply0 | FAIL | I01 |
| A-empty_hash | Malformed/contradictory manifest must supply0 | PASS | — |
| A-quantity-unit | Unsupported request unit blocks | FAIL | I04 |
| B-MOCK-test_fixture | Untrusted synthetic declaration is not real authorized supply | PASS | — |
| B-MOCK-product | Untrusted synthetic declaration is not real authorized supply | PASS | — |
| B-REAL-test_fixture | Untrusted synthetic declaration is not real authorized supply | PASS | — |
| B-REAL-product | Untrusted synthetic declaration is not real authorized supply | FAIL | I05 |
| B-EXISTING-test_fixture | Untrusted synthetic declaration is not real authorized supply | PASS | — |
| B-EXISTING-product | Untrusted synthetic declaration is not real authorized supply | FAIL | I05 |
| B-existing-mock-contradiction | Mode/mock conflict supply0 | FAIL | I03 |
| B-rights-without-approval | rights claim alone must not accept | PASS | — |
| C-unreleased | No trusted existing asset receipt means supply0 | FAIL | I06 |
| C-review_hold | No trusted existing asset receipt means supply0 | FAIL | I06 |
| C-wrong_TASK | No trusted existing asset receipt means supply0 | FAIL | I06 |
| C-attempted | No trusted existing asset receipt means supply0 | FAIL | I06 |
| C-wrong_revision | No trusted existing asset receipt means supply0 | FAIL | I06 |
| C-nonexistent | No trusted existing asset receipt means supply0 | FAIL | I06 |
| C-arbitrary_hash | No trusted existing asset receipt means supply0 | FAIL | I06 |
| C-arbitrary_rights_quality | No trusted existing asset receipt means supply0 | FAIL | I06 |
| C-shared_passage_seen | No trusted existing asset receipt means supply0 | FAIL | I06 |
| C-whole_exam_seen | No trusted existing asset receipt means supply0 | FAIL | I06 |
| C-wrapper-positive-control | Under explicit prevalidated input assumption wrapper preserves candidate1; no real release proved | PASS | — |
| D-binding-id | Changed identity or evidence revision/hash cannot inherit approval | PASS | — |
| D-binding-revision | Changed identity or evidence revision/hash cannot inherit approval | PASS | — |
| D-binding-sha256 | Changed identity or evidence revision/hash cannot inherit approval | FAIL | I07 |
| D-binding-source | Changed identity or evidence revision/hash cannot inherit approval | FAIL | I07 |
| D-binding-analysis | Changed identity or evidence revision/hash cannot inherit approval | FAIL | I07 |
| D-binding-gold | Changed identity or evidence revision/hash cannot inherit approval | FAIL | I07 |
| D-fq-task | Other TASK/role rejected | PASS | — |
| D-fq-role | Other TASK/role rejected | PASS | — |
| D-untrusted-approval-booleans | No actual server approval receipt: hold | FAIL | I05 |
| D-revoked-and-other-scope-control | Revoked/other qualification approvals not used | PASS | — |
| D-delivery-attempted | Assessment exposure must block at delivery | PASS | — |
| D-delivery-explanation_seen | Assessment exposure must block at delivery | PASS | — |
| D-delivery-shared_passage_seen | Assessment exposure must block at delivery | PASS | — |
| D-delivery-unknown | Assessment exposure must block at delivery | PASS | — |
| E-standard-JSON | Request body must parse standard JSON | FAIL | I08 |
| E-request-property-order | Same object values reuse | PASS | — |
| E-request-user | Same body reuse; changed same key reject; changed scope new create | PASS | — |
| E-request-workspace | Same body reuse; changed same key reject; changed scope new create | PASS | — |
| E-request-goal | Same body reuse; changed same key reject; changed scope new create | PASS | — |
| E-request-plan | Same body reuse; changed same key reject; changed scope new create | PASS | — |
| E-request-TASK | Same body reuse; changed same key reject; changed scope new create | PASS | — |
| E-request-role | Same body reuse; changed same key reject; changed scope new create | PASS | — |
| E-request-quantity | Same body reuse; changed same key reject; changed scope new create | PASS | — |
| E-request-support | Same body reuse; changed same key reject; changed scope new create | PASS | — |
| E-request-source | Same body reuse; changed same key reject; changed scope new create | PASS | — |
| E-request-education | Same body reuse; changed same key reject; changed scope new create | PASS | — |
| E-request-same_body | Same body reuse; changed same key reject; changed scope new create | PASS | — |
| E-demand-nested-order | Semantically same nested demand yields same key | FAIL | I09 |
| F-unit-guided | Exact declared current unit status | PASS | — |
| F-unit-model | Exact declared current unit status | PASS | — |
| F-unit-analysis | Exact declared current unit status | PASS | — |
| F-unit-assessment | Exact declared current unit status | PASS | — |
| F-unit-unknown | Exact declared current unit status | PASS | — |
| F-unit-no_factory | Exact declared current unit status | PASS | — |
| G-three-one-candidate | Produced3, eligible runnable candidate1 | PASS | — |
| G-assessment-fulfillment | Accepted runnable candidate1/need3 means partial candidate fulfillment, not zero | FAIL | I10 |
| G-candidate-not-delivery | Candidate count may1 but learner gate stays explicit; NOT delivery | PASS | — |
| G-stale-verdict-id-only | Stale ID-only verdict must not bind new revision | FAIL | I02 |
| H-teaching-fail-source_analysis | Teaching defect blocks instructional roles | FAIL | I11 |
| H-teaching-fail-model_explanation | Teaching defect blocks instructional roles | PASS | — |
| H-teaching-fail-guided_practice | Teaching defect blocks instructional roles | PASS | — |
| H-need-stock-independent | No stock keeps educational demand and plan-stage quantity | PASS | — | 

실제 출력과 전 합성 fixture는 [원장](data/counterexamples.json)에 있다. counterexamples.test.ts의 assert는 결과 재현을 검사하고 --acceptance가 안전 FAIL을 exit1로 보고한다. 후속 코드 revision에서 결과가 바뀌면 최초 원장을 덮지 않고 새 review-r2 원장을 만든다.

검사 분모가 다른 original19/new82/실제0을 합쳐 교육적 성공률로 보고하지 않는다.
