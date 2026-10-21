# T-0082 rev1 · independent REWORK

HEAD `0dd0281d831908e435454cdb470ed0c207a378c7`.

**T0082-P1-1 — Workspace row still recommends an extra closed-episode check.**

- Condition: actual compose from four independent attempts (wrong, wrong, correct, correct), successful guided repair and two transfer passages. Current TASK is `resolved` + `MAINTAIN`, with unseen independent links `authored:cm-ind-5/6`.
- Expected: no default next-assessment recommendation for this pending-maintenance TASK on the top bar, summary, inspector **or Workspace row**. Existing material/history remains readable and other real TASK actions stay available.
- Actual: rank correctly reports `maintain_pending`, but `workspaceRows(view)` independently reads `TaskPlan.next` and produces `state=runnable`, `next=/csat/learn/cm-ind-5?d=fixture`. `WorkspaceList` renders `바로 할 수 있어요` and `ws-next` for that assessment. The sender's own `maintain-1-1280.png` visibly contains this remaining route.
- Cause: rank exclusion is not propagated to the Workspace row projection; changing `WHY_NOT` only changes the collapsed blocked-TASK chip.
- Minimum fix: reuse `maintainPassed` in the Workspace row/display projection (or another equally small shared projection). Suppress this TASK's **default next** and runnable claim without hiding past records, changing global material access, current check state, plan history, or unrelated TASK actions. Preserve actual REPAIR recheck/transfer/CONFIRM paths.
- Scope extension approved for the same task/rev: `apps/web/src/lib/csat/map/v62/workspace-list.ts` and its focused `__tests__/workspace-list.test.ts`, plus existing allowed `WorkspaceList.tsx` and `maintenance-state.test.ts`. Do not edit V4, diagnosis, demand, SQL or approval gates.
- Reverify: actual compose→workspaceRows→WorkspaceList with links 0/present; two PC widths; assert actual row `ws-next` absent for maintenance and no `runnable`/`in_progress` status inferred from it. A different actually executable TASK remains a positive control. Reuse the already passing top/summary/inspector/goal-guard tests; no full suite or per-task CI.

Independent focused submitted tests: 8/8. Independent raw-attempt projection checks: five pass, one P1 row assertion fails, one **nonblocking P2 advisory wording** assertion fails. Chromium sole-maintenance top/summary checks 4/4; authenticated Next+DB and global 3B styling NOT_VERIFIED.

**T0082-P2-1 (optional, not a gate):** only-maintenance top amount still says `쓸 수 있는 자료가 생기면 정해져요` although the adjacent wait reason correctly says interval/instrument are undecided. Prefer a consistent maintenance-specific amount explanation when convenient. It does not enable a link or change evidence and is not the reason for REWORK.

The independent harness initially omitted the explicit goal argument to `composeV4`; that draft failure is not a product defect. The final probe passes `{score:80,set:true}` and injected time, verifies actual `resolved`/`MAINTAIN`, and reproduces the Workspace row with real raw-attempt scoring.

```json
{
  "task_id": "T-0082",
  "design_revision": "rev1",
  "head": "0dd0281d831908e435454cdb470ed0c207a378c7",
  "verdict": "REQUEST_CHANGES",
  "decision": "REWORK",
  "findings": [
    {"id":"T0082-P1-1","severity":"P1","scope":"in","summary":"Workspace row still recommends the closed-episode check hidden by rank"},
    {"id":"T0082-P2-1","severity":"P2","scope":"in","summary":"Advisory only: generic stock-based amount wording on maintenance-only top"}
  ],
  "ran_tests": true,
  "provenance": {"contract":"local-roles/1","task_id":"T-0082","head":"0dd0281d831908e435454cdb470ed0c207a378c7","implementer":"claude","reviewer":"codex","owner":"final-independent-accept","session_id":"01a14de8-2485-7a53-b530-d5612f35e57a"}
}
```
