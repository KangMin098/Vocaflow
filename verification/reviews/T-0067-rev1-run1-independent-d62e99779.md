<!-- verification/reviews/T-0067-rev1-run1-independent-d62e99779.md -->
# T-0067 rev1 independent result

HEAD `d62e99779a0177a7e3e57ff4f4ae9e71171e83a9` · REWORK for one remaining P1. Original false-order-success issue is fixed. No new task/design revision or server/SQL rewrite requested.

```json
{
  "task_id": "T-0067",
  "design_revision": "rev1",
  "head": "d62e99779a0177a7e3e57ff4f4ae9e71171e83a9",
  "verdict": "REQUEST_CHANGES",
  "decision": "REWORK",
  "ran_tests": true,
  "fixed": {"T0067-P1-1": "VERIFIED_FIXED: actual handler records separate outcome; zero/partial unconfirmed orders do not claim receipt; confirmed-order normal control now checks semantic outcome rather than old setMsg text"},
  "findings": [
    {
      "id": "T0067-P1-2",
      "severity": "P1",
      "scope": "in",
      "file": "apps/web/src/components/csat/diagnosis/map/AuthoredSupplyCard.tsx",
      "summary": "Unattempted material with unknown current eligibility still has an active learn link and the normal unattempted label.",
      "reproduce": "Listed installed row: attempted=false,current=null (also missing current). Actual card element tree still contains /csat/learn/<id>?d=<delivery>. Server listDelivered can produce null through currentOf RPC failure.",
      "expected": "Unknown current eligibility must not be promoted to a new-learning action; explain that availability could not be confirmed and provide refresh/recheck. Preserve verified-current action and server-supported past-result access.",
      "cause": "Link removal only covers current===false && !attempted; null/undefined fall through to Link and 'not yet answered'.",
      "minimum_fix": "Use explicit current eligibility for new-learning links and distinguish unknown from revoked. Keep history/valid controls, same TASK return context, and server access guard unchanged.",
      "risk": "Learner-facing eligibility and next-action contract failure, not a demonstrated server authorization bypass."
    },
    {
      "id": "T0067-P2-1",
      "severity": "P2",
      "scope": "in",
      "file": "apps/web/src/components/csat/diagnosis/map/AuthoredSupplyCard.tsx",
      "summary": "503 not_installed is still described as missing reviewed/approved content, although the route explicitly means supply infrastructure is not installed.",
      "expected": "Use a preparation/unconfirmed-service message based on the existing closed code, without inferring a Gold/rights cause.",
      "minimum_fix": "Small existing 503 message branch correction; no API change needed.",
      "blocking": false
    }
  ],
  "verification": {
    "independent_probe": {"passed": 8, "failed": 3, "skipped": 0, "failures": "2 manifestations of P1-2;1 P2-1"},
    "related_tests": {"passed": 16, "failed": 0, "skipped": 0},
    "controls": "Semantic original zero/partial/confirmed order, mixed role outcomes, malformed outcome, valid link, revoked unattempted no-link, prior-result link all pass.",
    "ci": {"run": "39448091504", "exact_head": true, "conclusion": "success", "isolated_e2e": "23/23", "shared_dev": "skipped"},
    "artifacts": "All4 submitted artifact and all28 screenshot hashes match. Existing authenticated journeys retained; new outcome browser tests mock supply API responses and are not delivery DB success evidence.",
    "scope": "Only card display, seven unit cases and two mock-response browser cases changed. Server/SQL/grade/G2/PLAN/canon unchanged and reused. Original first-failure probe/log remains intact; new probe understands outcome state."
  },
  "provenance": {"task_id":"T-0067","head":"d62e99779a0177a7e3e57ff4f4ae9e71171e83a9","implementer":"claude","reviewer":"codex","owner":"final-independent-accept","process_id":31380,"session_id":"01a14de8-2485-7a53-b530-d5612f35e57a"},
  "limits": ["No product merge/integration", "No developer DB application/write", "No human Gold/rights approval", "No actual learner-effect claim"]
}
```

Runnable semantic probe and preserved failures: `verification/reviews/T-0067-r1-independent/`. Its mock hooks/fetch exercise the actual component handler and output tree; it is not an authenticated browser/DB test. Original probe under `T-0067-initial-probe/` is preserved and its outdated setMsg control is not used as a product failure.

Recheck the changed display branch plus the original successful outcomes after the minimum correction. Keep valid new-learning and previous-result controls; avoid repeating unchanged G2/PLAN suites. P2-1 is a small optional same-file correction and does not create an additional mandatory acceptance gate.
