<!-- verification/reviews/T-0072-r1-independent/REVIEW.md -->
# T-0072 rev1 independent review

HEAD `56b166a0fcbf1957d9106e352ed32b58f1839c30`, base `0649f8c0b1a21e51ba8431a35ac869d8ea620eaf`. **Code/component scope ACCEPT_WITH_LIMITS.** No in-scope P0/P1 found. The original three goal-only counterexamples are VERIFIED_FIXED. Authentication/Next/isolated PostgreSQL browser acceptance remains NOT_VERIFIED; task stays REVIEW until the official integration bundle supplies it.

Independent execution: original probe 5/5 (previously three failed), focused next-action/goal-plan/goal-binding/editor tests 36/36, skip0. Actual Chromium using the real React PlanSection: eight scenarios pass, zero failed; one additional P2 observation is not counted as a successful test. Covers both1440/1280 goal refresh, matching goal, read-only history, changed-again goal, POST success without refetch, server409, and explicit user reason. HTTP and router refresh are mocked; these results are not authenticated Next+DB acceptance, full-map visual QA, or a claim of reference-design equivalence. The bare component screenshot has no global product skin. Existing CSS is unchanged.

The original writer artifact hashes match E01/E02 exactly. E01's actual log contains **2704 passed / 52 skipped, 212 passed files / 9 skipped files**, whereas its metadata says skip_count0. Preserve the original record; this review corrects interpretation rather than recording those skips as passed. Focused independently executed scope has36passed/0skipped. No full-suite rerun is needed to obtain an already present summary.

The same goalMismatch predicate now gates top action, summary and editor; legacy null with an existing current goal requires confirmation. Current stored data and errors are not overwritten. Existing server expectedGoalVersion/expectedVersion/clientKey, request signatures, append-only history and G2 are unchanged; the previously accepted CAS tests were reused. There is no SQL/API/canon/content/rights/Gold change. The restored plan-goal-binding.test.ts is byte-identical to base. Both foreign tracked audit artifacts remain untouched.

P2, nonblocking: goal-only change now also renders plan-drift claiming available content changed, because goalChanged widens needsReplan while plan-drift uses that same condition. Render that notice only for actual content/definition/stage drift. Do not repeat the accepted goal logic or broaden this into a UI redesign.

Official integration timing: do not delay this P1 fix waiting for a speculative next task. The current ten-file T0072 change is a valid official product integration bundle. Existing final-product owner should push the existing branch and open one main-targeted PR (or reuse a matching already-open one), after checking latest main and preserving foreign edits. Run the existing required CI once, including goal-plan-version1440/1280; retain first failures. Do not use shared-dev workflow_dispatch. Return exact tested HEAD, CI/report and product-skin captures; no actual DB installation/human approval follows from CI. Merge only after independent authenticated acceptance and existing safe-merge. Local integration has not been claimed or attempted through an incomplete gate.

```json
{
  "task_id":"T-0072","design_revision":"rev1","head":"56b166a0fcbf1957d9106e352ed32b58f1839c30",
  "verdict":"APPROVE","decision":"ACCEPT_WITH_LIMITS","ran_tests":true,
  "verification_mode":"Independent original counterexample and focused tests plus actual Chromium component execution; authenticated isolated browser pending official bundle",
  "findings":[
    {"id":"T0072-P2-1","severity":"P2","scope":"in","message":"Goal-only revision also claims content availability changed; restrict plan-drift notice to actual drift."},
    {"id":"T0072-EVIDENCE-NOTE","severity":"P2","scope":"in","message":"Original broad unit log has52skips despite skip_count0 metadata; preserved and explicitly corrected in this review, not counted as pass."}
  ],
  "verification":{"original_probe_passed":5,"focused_tests_passed":36,"focused_tests_skipped":0,"chromium_component_passed":8,"chromium_component_failed":0,"authenticated_isolated_browser":"NOT_VERIFIED","official_ci":"NOT_RUN","local_integration":"NOT_RUN","db_write":false,"human_gold_or_rights_approved":false},
  "provenance":{"contract":"local-roles/1","task_id":"T-0072","head":"56b166a0fcbf1957d9106e352ed32b58f1839c30","implementer":"claude","reviewer":"codex","owner":"final-independent-accept","process_id":16328,"session_id":"01a14de8-2485-7a53-b530-d5612f35e57a"}
}
```
