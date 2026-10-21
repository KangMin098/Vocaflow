<!-- verification/reviews/T-0074-r1-independent/REVIEW.md -->
# T-0074 rev1 independent acceptance

HEAD eb7c92b8373a5a3eb897a7bd175c498c659de17d: **ACCEPT_WITH_LIMITS (LOCAL_FAST code and component scope)**. No in-scope product P0/P1 found. Current-policy pass remains distinct from delayed retention NOT_ESTABLISHED. Existing EvidenceChips/current labels and canonical learner criterion are reused. Missing evidence and unknown ledger explicitly mean unable to confirm, not zero. Existing past/read-only actions and navigation are unchanged; grading/G2/As-Is/PLAN/SQL/canon have no changed implementation.

Independent focused unit18/18, skip0; real-enum probe3/3, skip0; actual React+Chromium component2/2 at1440x900 and1280x900, direct Node exit0. Verified actual '통과(지금 기준)' label, delayed-unknown label, resolved caveat, no redundant unmeasured chips, unknown-ledger and missing-evidence text, keyboard summary toggle, visible focus, no page error or horizontal overflow. Both screenshots opened independently. Existing map CSS and CSAT type-scale tokens applied; controlled fixture/system-font environment, not authenticated Next/DB or exact reference-pixel equivalence. Existing goal-summary scrolling is unchanged; no claim all rows fit without scrolling. Source review and focused existing tests cover unchanged navigation/past/PLAN gates; this component run does not exercise authenticated navigation.

Authenticated journey assertions were added but **NOT_VERIFIED**, as expressly allowed by acceptance3. Execute them with next real official integration bundle. No per-task PR/push/CI is requested. Local acceptance is not official-main integration, release approval, delayed-retention validation or learner-effect evidence.

P2 fixture correction: my supplied baseline and the copied owner fixtures used raw outcome passed_current_policy as an EvidenceView.currentCheck value, whose actual type uses passed. That hid the existing chip label in synthetic screenshots. The original baseline and owner E01/E02 are preserved with this limitation. Independent actual-enum.test.ts explicitly checks the real nonblank label and passes3/3; independent browser run also checks it. Correct the copied fixtures and retain that label assertion in the next ordinary owner commit, without a new TASK, whole-suite rerun or blocking REWORK. This is our baseline error, not a product defect.

Owner hash-bound E01/E02 artifacts were independently verified unchanged. Owner1340pass/2named live skips is not a claim those live tests passed. No actual DB writes, Gold/rights approval or qualifying real supply established. Whole FINAL MISSION remains incomplete.

```json
{
  "task_id": "T-0074",
  "design_revision": "rev1",
  "head": "eb7c92b8373a5a3eb897a7bd175c498c659de17d",
  "verdict": "APPROVE",
  "decision": "ACCEPT_WITH_LIMITS",
  "findings": [
    {
      "severity": "P2",
      "scope": "in",
      "id": "T0074-FIXTURE",
      "claim": "Original reviewer baseline and copied owner fixtures use passed_current_policy instead of EvidenceView currentCheck status passed. Correct during next normal test commit; independently corrected fixture verifies actual current-check label. Nonblocking test fixture correction, not product REWORK."
    }
  ],
  "ran_tests": true,
  "verification": {
    "focused_unit_passed": 18,
    "actual_enum_probe_passed": 3,
    "react_chromium_pc_passed": 2,
    "authenticated_next_db": "NOT_VERIFIED — next official integration bundle",
    "dev_db_applied": false,
    "human_gold_or_rights_approved": false
  },
  "provenance": {
    "contract": "local-roles/1",
    "task_id": "T-0074",
    "head": "eb7c92b8373a5a3eb897a7bd175c498c659de17d",
    "implementer": "claude",
    "reviewer": "codex",
    "owner": "final-independent-accept",
    "session_id": "01a14de8-2485-7a53-b530-d5612f35e57a",
    "process_id": 16328
  }
}
```
