<!-- verification/reviews/T-0063-rev1-run1-independent-60d1fc126.md -->
# T-0063 rev1 independent result

HEAD `60d1fc1267be34ff5e93f29ab7f1c6a6fcda186e` · REWORK. Same task/design/owner; one P1. Original append-only save and normal single-edition journey work. No new gate or broad retest requested.

```json
{
  "task_id": "T-0063",
  "design_revision": "rev1",
  "head": "60d1fc1267be34ff5e93f29ab7f1c6a6fcda186e",
  "verdict": "REQUEST_CHANGES",
  "decision": "REWORK",
  "ran_tests": true,
  "findings": [{
    "id": "T0063-P1-1",
    "severity": "P1",
    "file": "apps/web/src/components/csat/theater/ReasoningNoteForm.tsx",
    "line": 90,
    "summary": "Model comparison uses the selected root hash while rendering the latest revision of that root.",
    "expected": "Compare only the explanation actually displayed against the current annotation edition.",
    "actual": "A selected root in edition A authorizes comparison of its displayed revision in edition B with model A. Conversely, displayed revision B is blocked against model B when selected root A is stale.",
    "cause": "cur = latest ?? shown, but sameEdition inspects shown.authored.annotationHash rather than cur.",
    "minimal_fix": "Bind the model visibility/open action to the displayed revision's edition. Preserve immutable original notes and existing retry/CAS/G2 behavior. Add both mixed-edition regression controls. No new table or SQL."
  }],
  "verification": {
    "independent_probe": {"passed": 4, "failed": 2, "skipped": 0},
    "related_tests": {"passed": 33, "failed": 0, "skipped": 0},
    "ci": {"run": "39431605974", "event": "pull_request", "head_match": true, "conclusion": "success", "authenticated_isolated_e2e": "21/21", "shared_dev": "skipped"},
    "evidence": "All four submitted artifact hashes and all22 screenshot hashes match. Read exact-head CI metadata and isolated test log. No local authenticated browser rerun. One1280 capture inspected; not a full independent visual acceptance.",
    "scope": "Independent two-edition actual-component static render, revision failure/retry/id preservation, later-edit preservation, existing normalization/CAS union tests. Existing G2/PLAN behavior unchanged and reused.",
    "first_failure": "verification/reviews/T-0063-r1-independent-probe/run.log"
  },
  "provenance": {
    "task_id": "T-0063",
    "implementer": "claude",
    "reviewer": "codex",
    "owner": "final-independent-accept",
    "session_id": "01a14de8-2485-7a53-b530-d5612f35e57a",
    "process_id": 31380
  },
  "limits": ["No product integration or merge", "No shared development DB write/application", "No human Gold or rights approval", "No actual learner or learning-effect claim"]
}
```

Reproduce from the product worktree:

`pnpm.cmd --filter web exec vitest run -c D:/workspace/Vocaflow-AI-Control/verification/reviews/T-0063-r1-independent-probe/probe.config.mjs`

Controls: current-root/current-revision comparison works; stale single note stays unpaired; failed revision keeps parent/text/id/initial time; successful save preserves subsequent input. Two mixed-edition comparison assertions fail against the actual component. These cases can arise when the same material retains old notes and receives a new annotation edition, including another tab adding a revision while the root remains selected.

Recheck only the two failing assertions and focused note tests after the minimum fix; retain the unchanged authenticated journey evidence where its code/environment remain applicable. Official integration checks still apply separately. Overall FINAL MISSION is not complete.
