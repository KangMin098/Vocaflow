<!-- verification/reviews/T-0078-r1-independent/REWORK.md -->
# T0078 rev1: one remaining input-failure branch

HEAD f6876bd3bfcfa5d0075d49b4d063a8fb3ebdea52 **REWORK, T0078-P1-1 only**. The original missing-first/missing-activity cases are fixed; independent original4/4 and focused32/32 pass, skip0. No repeat of accepted source or wholesale redesign is requested.

**Actual failure:** invoke exported loadAuthoredDeliveries with one owned delivered row and valid query, then have workspace_delivery_current and supply_delivery_valid both return {data:null,error:{message:...}}. It resolves[] instead of propagating unavailable. Both results {data:null,error:null} also resolve[]. The actual loader line `return (await db.rpc(...)).data === true` collapses every non-true result to false. deliveriesRead stays true, so missing targets can feed a false empty-read calculation despite the new compose/API guard. This is a loader-level reproduction, not a claim of actual development DB mutation.

**Expected:** accept only an explicitly successful boolean verdict from either legitimate existing path. A legitimate primary false is final invalid; keep it filtered and do not reinterpret as an outage. Legitimate service-role fallback true/false are known validity states. If neither path produced a successful boolean (RPC error/null/malformed), throw a read-unavailable error so the existing loadMapPage catch marks mandatory input unavailable. Never convert unknown to valid or relax auth/RLS.

**Minimal fix:** only validOf in loadAuthoredDeliveries plus its existing load-evidence-read.test.ts. Add both RPC error/null controls and preserve explicit false / valid fallback true/false. Existing outer catch/undefined, compose null,503 no-write guards, historical receipt precedence and UI recovery remain unchanged. Do not rerun unrelated195 checks. Reuse this HEAD matched owner browser artifact for unchanged UI where stated; actual authenticated outage remains NOT_VERIFIED. No new endpoint/SQL/permissions/Gold/rights.

Independent executable counterexamples: delivery-validity.test.ts and results.json in this folder. Full initial failure is preserved.

```json
{
  "task_id": "T-0078",
  "design_revision": "rev1",
  "head": "f6876bd3bfcfa5d0075d49b4d063a8fb3ebdea52",
  "verdict": "REVISE",
  "decision": "REWORK",
  "findings": [
    {
      "id": "T0078-P1-1",
      "severity": "P1",
      "scope": "in",
      "file": "apps/web/src/lib/csat/map/load.ts",
      "function": "loadAuthoredDeliveries.validOf",
      "issue": "Both validity RPC errors or null/nonboolean results resolve to an empty valid-delivery list; the caller therefore treats qualification lookup failure as a successful0-row read and can still derive fresh MAP/PLAN/supply from incomplete input."
    }
  ],
  "ran_tests": true,
  "verification": {
    "original_probe": "4/4 independently passes",
    "new_validity": "2 failed; actual async loadAuthoredDeliveries resolved[] instead of rejecting. Fallback true and false controls pass.",
    "focused_unit": {
      "passed": 32,
      "failed": 0,
      "skipped": 0
    },
    "authenticated_next_db": "NOT_VERIFIED",
    "db_write": false
  },
  "provenance": {
    "task_id": "T-0078",
    "head": "f6876bd3bfcfa5d0075d49b4d063a8fb3ebdea52",
    "implementer": "claude",
    "reviewer": "codex",
    "owner": "final-independent-accept",
    "session_id": "01a14de8-2485-7a53-b530-d5612f35e57a"
  }
}
```
