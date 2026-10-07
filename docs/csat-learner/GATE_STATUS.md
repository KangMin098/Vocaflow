# CSAT Error Cause gates — authoritative lineage

Reconstructed on 2026-10-07 from all branch history, gate documents, implementation/tests, migration state and local operational artifacts. **G3 remains CLOSED. G4 already closed; the actual next operational gate is G6.** Gate numbers from unrelated design/corpus initiatives are not part of this lineage.

| Gate | Actual purpose | Status | Authoritative evidence |
|---|---|---|---|
| G3 | Server-side Reveal embargo and permission boundary | CLOSED | `docs/reports/reveal-gate-g3-closure-20261007.md`, `feat/ec-reveal-app` closure commit `8ccb3b9cc` |
| G4 | Deterministic, correctness-independent boundary detector: interpretation → signal → targeted probe → completion | CLOSED | `feat/ec-smoke`, commit `9990c3886`; `docs/csat-learner/codebook/BOUNDARY_DETECTOR_DESIGN.md` §12 and “G4 종료” |
| G5 | v0.1 operational Pilot protocol approval | CLOSED | `feat/ec-smoke`, commit `eacb01e6f`; `docs/csat-learner/codebook/PILOT_PROTOCOL.md` |
| G6 | Actual consented participant Pilot, sealed run/deployment, same-commit E2E and start authorization | BLOCKED — operator inputs not supplied | `PILOT_PROTOCOL.md` §20; `docs/csat-learner/pilot-runs/README.md` and `OPERATOR_KIT.md` on `feat/ec-smoke` |

G4's recorded closure includes actual detector smoke 17/17, correctness invariance, corrected/obsolete signals, post-completion refusal, atomic rollback, canary and permission checks. These are historical results, not rerun results. Current read-only DB verification confirms migration `20261006120000`, detector/boundary tables and the single detector function with `bd-0.1.0`. Rebuilding an invented G4 would duplicate completed work.

G5's approval is the existing repository decision: recruitment/consent belong to the operator; participant identities stay outside Git; a separate G6 start authorization follows the checklist. The current instruction to reconstruct/implement readiness does not supply participant consent or a sealed actual run.

## Existing G6 implementation to reuse

Implementation begins at `ce50ee8b0`, with operational follow-ups through `d39743747` on `feat/ec-smoke`:

- `scripts/csat/pilot/prepare-run.mjs`: validate private mapping, run PII guards, build/E2E, seal metadata and prepare private deployment env in one operation.
- `seal-run.mjs`, `start-check.mjs`, `live.mjs`: sealed identity/current DB/env/records comparison; fail closed on mismatch.
- `apps/web/src/lib/csat/ec-pilot/run-gate.ts`: actual-run admission and integrity checks.
- `scripts/csat/error-evidence/model-input/`: identity removal and packet guards.
- `pilot-runs/OPERATOR_KIT.md`: unseen-exam survey and participant information/consent draft.

G6 readiness inspection reproduced a TLS defect in `live.mjs` (`rejectUnauthorized:false`). It was corrected on `feat/ec-smoke` by reusing the unchanged verified TLS helper. The G6 wrapper also handles `sslnegotiation` CA replacement and removes credential-bearing malformed URL inputs from errors. G6 unit/record checks passed 11/11; actual verified TLS, rejection of an invalid CA and read-only `readLive` succeeded. This does not reopen G3 or start the Pilot.

## Remaining operational inputs

1. Confirm recruitment and consent. Developer/admin/test accounts cannot substitute for actual participants (`PILOT_PROTOCOL.md` §2).
2. Select two common unseen exams from the approved survey and supply the private anonymous mapping. Neither identity nor mapping is recorded in reports/Git.
3. Select the integrated deployment commit, prepare/seal the actual run, then set the actual deployment env.
4. Run E2E for that same sealed run and deployment commit; execute `start-check.mjs` and obtain the already-required G6 start authorization (§20).

The inspected source worktree contains zero sealed actual-run JSON files and no default private mapping. The locally loaded env has `DEV_ADMIN_USER_ID present`; it has no active-run/app-commit/participant configuration. These are local observations, not a claim about every deployment or private operator file.

The existing recorded verification-mode E2E is 8/8 with clean residuals at commit `c9c5584ba`. It is historical test-account evidence and does not match the current source commit. It cannot be promoted to an actual-run receipt. A further broad G3/build/E2E replay without real run inputs would not close this gap.

## Branch ownership and resumption

`feat/ec-reveal-app` carries the closed G3 audit evidence; `feat/ec-smoke` carries later G4/G5/G6 implementation. A missing document in the first worktree is not a missing gate in the repository. Sibling dirty audit/SQL artifacts were left untouched, and branches were not automatically merged.

Resume G6 from the established operator inputs and pinned source/deployment commit. `prepare-run.mjs` already bundles the work; do not invent a new run, use test users as participants, alter closed gates or apply extra migrations. Detailed readiness evidence: [2026-10-07 report](../reports/csat-next-gate-readiness-20261007.md).
