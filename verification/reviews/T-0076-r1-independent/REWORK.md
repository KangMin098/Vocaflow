<!-- verification/reviews/T-0076-r1-independent/REWORK.md -->
# T-0076 rev1 — REWORK

HEAD f9c0368455bde1f24f675f4b2de5d5e249b873ce. Original supplied6 cases independently PASS. **P1 T0076-P1-1 only: unread ledger is displayed as measured current zero.**

Independent SSR actual evidenceView→EvidenceBlock: check=null, firsts=undefined, activity=undefined gives ledger=unknown and currentCheck.status=unknown, but ev-check says 「확인 기록 조회 보류 · 이번 판정의 독립 확인 0문항」. With firsts=[] and missing activity, it says 「아직 확인 전 · 이번 판정의 독립 확인 0문항」 despite ledger unknown. Both negative cases fail. Readable firsts=[]/activity=[] is the legitimate known-zero control and passes. Report results.json:7pass/2fail/skip0 including original6 controls. Source: new header always interpolates currentCheck.independentItems; it removed the old unknown-ledger guard for that number.

Expected: when the necessary ledger is unread/unknown, display count pending/unconfirmed rather than a measured0 (or a misleading completed current count). Preserve currentCheck/raw historical facts in the data; no engine/SQL change. Existing ledger flag is sufficient for a conservative display guard. Current count can be shown when its source is readable; known-empty complete ledgers still show0. Distinguish current-check count from detailed full-period/current-annotation counts as already implemented. Avoid unknown numeric data attributes being read as a proven zero if those attributes are retained.

Minimum scope: EvidenceClaims.tsx and its focused unknown/known-zero/known-two controls. The existing component fixture ledger-unknown currently uses a known-two check for every case; adjust its expected display to the explicit unconfirmed state as needed, without weakening normal known-two checks. No need to repeat all217 or retest unchanged compose/repair/DB logic. Authenticated NOT_VERIFIED and daily-sync policy unchanged. Same task/revision, no new PR/worker.

```json
{
  "task_id": "T-0076",
  "design_revision": "rev1",
  "head": "f9c0368455bde1f24f675f4b2de5d5e249b873ce",
  "verdict": "REWORK",
  "decision": "REWORK",
  "findings": [
    {
      "id": "T0076-P1-1",
      "severity": "P1",
      "scope": "in",
      "claim": "Unknown/unread ledger becomes current independent count0 in new header."
    }
  ],
  "ran_tests": true,
  "verification": {
    "original_probe_passed": 6,
    "new_unknown_cases_failed": 2,
    "known_empty_control_passed": 1
  },
  "provenance": {
    "task_id": "T-0076",
    "head": "f9c0368455bde1f24f675f4b2de5d5e249b873ce",
    "implementer": "claude",
    "reviewer": "codex",
    "owner": "final-independent-accept",
    "session_id": "01a14de8-2485-7a53-b530-d5612f35e57a"
  }
}
```
