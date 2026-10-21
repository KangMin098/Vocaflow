<!-- verification/reviews/T-0075-r1-independent/REWORK.md -->
# T-0075 rev1 — REWORK

HEAD 023c8474dbb286a19039117634bc40aa515665ba. **P1 T0075-P1-1: late previous rebind response replaces current attempt return identity.**

First independent failure: actual React AuthoredRunner + Chromium1440, controlled delayed HTTP response (no authenticated Next/DB). Guided-practice submission A succeeds but binding status=error. Start reconnect A and keep its response pending. The retry button is still enabled. Retry with a new session/mutation B and save response B: result return URL correctly contains map_attempt=42. Release A's valid reconnect response(attemptId41): same current result return URL becomes map_attempt=41. race-results.json records distinct request keys, exact before/after and zero browser errors. The result still displays response B, so the map will select the wrong 'this activity'. No G2/DB row mutation/corruption is claimed from this browser fixture.

Cause: again() advances the current mutation/session while rebind() is pending. rebind() applies binding and savedAttempt without checking the submission captured at request start. This crosses the exact-attempt contract reused from T0062.

Expected: an old reconnect must not replace a newer submission's binding, error state or return id. Minimal fix may disable instructor retry while reconnect is pending (including direct handler guard), or discard reconnect completion when the captured mutation/session no longer matches. Prefer the smallest reliable change; no new engine/SQL/API is needed. Keep current network/HTTP/shape handling and exact owner lookup, normal and replay controls. Reuse owner16/16 and previous unit tests in unchanged scopes; run this added race plus affected tests, not the whole99/2700 suite merely for a button/state fix. Do not create a new task/revision or push/PR yet. On pass, proceed with the existing T0074+T0075 official bundle plan.

Optional nonblocking P2: NON_EVIDENCE_LABEL[b.reason] indexes a normal object, so prototype keys like constructor are outside the intended closed seven-code set. Use an own-key check if touching this helper; internal DB CHECK currently prevents such persisted reasons. This is not an additional merge blocker.

```json
{
  "task_id": "T-0075",
  "design_revision": "rev1",
  "head": "023c8474dbb286a19039117634bc40aa515665ba",
  "verdict": "REWORK",
  "decision": "REWORK",
  "findings": [
    {
      "id": "T0075-P1-1",
      "severity": "P1",
      "scope": "in",
      "claim": "A late prior reconnect overwrites the current submission map_attempt42 with41."
    }
  ],
  "ran_tests": true,
  "provenance": {
    "task_id": "T-0075",
    "head": "023c8474dbb286a19039117634bc40aa515665ba",
    "implementer": "claude",
    "reviewer": "codex",
    "owner": "final-independent-accept",
    "session_id": "01a14de8-2485-7a53-b530-d5612f35e57a"
  }
}
```
