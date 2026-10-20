<!-- verification/reviews/T-0063-rev1-run2-independent-38d4146c4.md -->
# T-0063 rev1 run2 independent acceptance

HEAD `38d4146c4490e50989753f577da6eda644319db9` · ACCEPT within T-0063. Original failure and its probe remain unchanged. Aggregate product integration and external approvals are separate.

```json
{
  "task_id": "T-0063",
  "design_revision": "rev1",
  "contract_version": "T-0063-rev1/dev-minimal-20261020",
  "head": "38d4146c4490e50989753f577da6eda644319db9",
  "verdict": "APPROVE",
  "decision": "ACCEPT",
  "findings": [],
  "ran_tests": true,
  "fixed": {"T0063-P1-1": "VERIFIED_FIXED: supplied-model comparison now uses the annotation edition of the displayed revision, not the selected root"},
  "verification": {
    "change_scope": "Only ReasoningNoteForm edition guard and two mixed-edition regression tests changed since the previous reviewed HEAD. No SQL, grading, G2, PLAN, auth, retry writer or CAS change.",
    "independent_probe": {"passed": 6, "failed": 0, "skipped": 0, "previous": "4 passed / 2 failed at60d1fc126; original source and failing log retained"},
    "related_tests": {"passed": 35, "failed": 0, "skipped": 0},
    "normal_controls": ["Same-edition model comparison", "Old-edition single note stays unpaired", "Failed revision retains text/parent/id/initial timestamp", "Successful response preserves subsequent input", "Normalizer compatibility and original/revision CAS ID union"],
    "ci": {"run": "39437921706", "event": "pull_request", "head_match": true, "conclusion": "success", "authenticated_isolated_e2e": "21/21", "shared_dev": "skipped"},
    "browser": "Exact-head official Next/Supabase/Chromium journey at1440/1280: optional note save/model compare, keyboard revision, cancellation, append revision, refresh original+revision and same-TASK return. Existing independent evidence/transfer and PLAN assertions retained. Executed in official isolated CI, not locally rerun by Codex.",
    "evidence_integrity": "All four current run2 artifact hashes and all22 current screenshot hashes match. Official CI metadata independently queried; submitted log confirms21 passed. New screenshot20 opened; unchanged layout and normal-path assertions reused.",
    "scope_reuse": "Existing save/retransmission/CAS and unchanged G2/PLAN acceptance retained from run1/T0062. No full unchanged suite repeated. Current relevant tests independently executed."
  },
  "provenance": {
    "contract": "local-roles/1",
    "task_id": "T-0063",
    "head": "38d4146c4490e50989753f577da6eda644319db9",
    "implementer": "claude",
    "reviewer": "codex",
    "owner": "final-independent-accept",
    "process_id": 31380,
    "session_id": "01a14de8-2485-7a53-b530-d5612f35e57a"
  },
  "limits": ["Task acceptance is not aggregate PR303/PR250 merge approval", "No developer DB application/write", "No human Gold/rights approval", "Isolated fixtures are not actual learner or learning-effect evidence", "Not PRODUCT_CORE_READY, RELEASE_READY or FINAL_COMPLETE"]
}
```

Reproduction uses the unchanged `T-0063-r1-independent-probe/probe.test.tsx` against the corrected product HEAD. Run2 logs and artifact inspection are under `verification/reviews/T-0063-r2-independent-probe/`. T0063-P1-1 no longer reproduces in either direction: current A cannot compare displayed revision B; current B can compare displayed revision B even when root A remains selected. Original and revised note data remain intact.
