# T-0081 rev1 REWORK — T0081-P1-1

HEAD 39051223d85e80188a22307bdc9939aeeb4ac7eb · P1 · same task/revision.

Actual applySaved keeps canonical core-only aggregate. With core2/2 complete and support4/1 remaining it returns progress2/2; with core plannednull and support4/1 it returns progressnull. Current mapProgressOf tests that aggregate before finding a row, so both return plan=null. Independent probe.test.ts:2fail3pass(skip0). Core-incomplete/saved-order, all-complete and source-read protections pass. Submitted14 focused checks pass; their aggregate6/3 is mocked despite a core2/2 row and masks this actual dependency.

Expected: saved unfinished support row still supplies the continuation task/Workspace. Do not change canonical core-only aggregation or imply support counts are core progress. Minimum change: select actual eligible unfinished row independent of the aggregate-progress gate; preserve no remaining row/goal-unset/past/read-failure protections.

Presentation: keep existing core aggregate values unchanged, includingnull as unknown/unallocated rather than0. If a support row is the continuation, expose its task name + existing row quantity/unit as a separately identified continuation amount. A core2/2 headline must not tell the learner that support4/1 is complete. A core-null case must not fabricate whole-workspace totals. Small DTO/UI adjustment in already allowed home-progress/HomeLanding and their tests is permitted by this existing contract; no new ranking/quantity policy, no SQL/API/G2/PLAN changes. Implementation may use a simpler equivalent representation, retaining explicit source distinction.

Retest only: this five-case probe→5/5, related mapper/render with real applySaved coverage for both failing cases (compose may use fixed synthetic projection), actual card name/count provenance and correct map_task/ws keyboard restoration1440/1280. Current passing link serialization and original stale-selection counterexample remain valid/reusable if unchanged. Do not rerun full suites. Authenticated isolated path stays NOT_VERIFIED until official bundle.

```json
{
  "task_id": "T-0081",
  "design_revision": "rev1",
  "head": "39051223d85e80188a22307bdc9939aeeb4ac7eb",
  "verdict": "REQUEST_CHANGES",
  "decision": "REWORK",
  "findings": [
    {
      "id": "T0081-P1-1",
      "severity": "P1",
      "scope": "in",
      "file": "apps/web/src/lib/csat/map/home-progress.ts",
      "function": "mapProgressOf saved plan branch",
      "issue": "Outer applied.progress (core-only) gate hides real unfinished support rows when core is complete or unallocated. Submitted support-case fixture mocks an inconsistent aggregate6/3 and does not exercise actual applySaved2/2 or null."
    }
  ],
  "ran_tests": true,
  "verification": {
    "actual_applySaved": "Independent5 cases:3 pass2 fail, skip0; compose projection supplied but saved row ordering/core aggregate use actual production applySaved.",
    "focused": "Independent submitted home-progress7 + HomeLanding render7 pass14; those use a mocked aggregate and do not discharge the failing dependency case.",
    "authenticated_e2e": "NOT_VERIFIED",
    "db_write": false
  },
  "provenance": {
    "contract": "local-roles/1",
    "task_id": "T-0081",
    "head": "39051223d85e80188a22307bdc9939aeeb4ac7eb",
    "implementer": "claude",
    "reviewer": "codex",
    "owner": "final-independent-accept",
    "session_id": "01a14de8-2485-7a53-b530-d5612f35e57a"
  }
}
```
