<!-- verification/reviews/T-0075-r2-independent/REVIEW.md -->
# T0075 rev1 local independent acceptance

HEAD 7cc5b08f868273f94c08d1fc0b85f738cba622c3: **ACCEPT_WITH_LIMITS (LOCAL_FAST code/component/isolated-PGlite scope). T0075-P1-1 VERIFIED_FIXED.**

Original failure preserved at T-0075-r1-independent/race-results.json: new submission42's map_attempt was replaced by delayed old reconnect41. Current implementation guards again() and disables its button while reconnecting. Rebind captures the sent mutation object and discards stale success/error results before changing binding, attemptId or failure text. Independent real React+Chromium at1440/1280 now confirms: pending retry disabled and keyboard cannot create submission2; request1 alone while pending; reconnect returns41 and retry unlocks; subsequent explicit retry creates distinct session/mutation2 and retains map_attempt42. Zero page errors/overflow. Two scoped screenshots opened independently. New harness records actual HEAD, avoiding old fixture's hardcoded metadata limitation.

Affected unit23/23 skip0 independently passed, including actual own-key lookup for the seven DB reason codes and inherited-key unknown control. Source changes after023c8474d are two client files, corresponding unit and ledger only. Independently passed64 backend/route/PGlite checks and16 original controlled-response component cases from023c8474d are reused in unchanged scope. They verify server-owned query/filtering and replay counters, not real Supabase RLS. Server and boundAttemptId helper are unchanged. Original ownerR1/R2 files are preserved; R2 race report's stale hardcoded head is expressly not used as exact-head proof. Independent actual-head run supplies that proof.

Initial submission/reconnect use same mutation+delivery; recovery never re-POSTs the answer. Only explicit later practice retry creates a new attempt. Role-specific non-evidence codes, unknown/missing states, strict evidence===true, original response correctness, exact server-owned attempt return and old records are preserved. No SQL, role/qualification rules, grading, G2 evidence or PLAN calculation changed. New client labels add no permission. No remaining scoped P0/P1.

**Limits:** authenticated Next+DB journey including controlled metadata loss, actual bind API, exact return recap and invariant counters is written but NOT_VERIFIED. Actual full-product skin/reference comparison on combined local-main is pending the official bundle; these fixed-data component captures omit the full app shell/global styling and do not certify full3B visual equivalence or broad accessibility. Existing CSS/skin is unchanged. Basic keyboard retry/disabled/busy restoration and PC readability of changed status controls were checked. PGlite does not prove RLS. No actual dev DB application, Gold/rights approval or learner effect is inferred. T0074 and T0075 remain not yet officially integrated.

Integration follows the current dev-minimal main_sync policy: existing local integration/main writer, preserve dirty foreign files; one daily sync/main bundle PR and exact-HEAD CI/safe-merge. No task-only PR. See planning/handoff/T0074-T0075-INTEGRATION-UTF8.md for executable existing-path instructions and actual blockers; no new worker/gate is introduced.

```json
{
  "task_id": "T-0075",
  "design_revision": "rev1",
  "head": "7cc5b08f868273f94c08d1fc0b85f738cba622c3",
  "verdict": "APPROVE",
  "decision": "ACCEPT_WITH_LIMITS",
  "findings": [],
  "ran_tests": true,
  "verification": {
    "race_pc": "2/2 independently passed1440/1280 with actual tested HEAD recorded",
    "affected_unit": "23/23 skip0",
    "reused_backend": "64/64 at023c8474d; backend SQL/routes/helpers/server unchanged in7cc5b08f8",
    "reused_component": "16/16 at023c8474d; new pending retry transition separately verified",
    "authenticated_next_db": "NOT_VERIFIED — next official sync bundle",
    "rls": "NOT_VERIFIED by PGlite",
    "db_applied": false,
    "human_gold_rights": false
  },
  "provenance": {
    "contract": "local-roles/1",
    "task_id": "T-0075",
    "head": "7cc5b08f868273f94c08d1fc0b85f738cba622c3",
    "implementer": "claude",
    "reviewer": "codex",
    "owner": "final-independent-accept",
    "session_id": "01a14de8-2485-7a53-b530-d5612f35e57a"
  }
}
```
