# Next CSAT gate reconstruction and readiness — 2026-10-07

**Scope reconstruction: COMPLETE. G4: CLOSED. G5: CLOSED. Next operational gate: G6 — BLOCKED on operator/run inputs. G3 stays CLOSED.**

## Evidence recovered

- All-ref commit search found G4 detector closure `9990c3886` and G5 protocol approval `eacb01e6f`, both already integrated into `feat/ec-smoke`.
- Canonical documents define G4's purpose/acceptance and G6's actual participant/start checklist. TODO/FIXME inspection did not establish a different unfinished G4. The known multiple-boundary P2 is conditional on a second provisional boundary, not a reason to reopen v0.1.
- Live read-only SQL confirms all three migrations `20261005170000`, `20261005170100`, `20261006120000`; detector-run and boundary-signal tables exist and `csat_ec_detect_boundaries` is present with `bd-0.1.0`.
- G6 already has prepare/seal/start-check/E2E, admission, identity-removal and operator-kit implementation. Existing recorded test E2E is 8/8 at a previous commit; it is not a current actual-run receipt.

## Implemented correction

Actual G6 `readLive` had an unconditional TLS verification bypass. On `feat/ec-smoke`, the same trusted-TLS helper already validated for G3 is reused unchanged; the G6 wrapper additionally strips `sslnegotiation` and removes credential-bearing malformed URL inputs from errors. Explicit CA/hostname validation remains enabled and URL SSL parameters cannot override it. `readLive` closes the client even if connection establishment fails. Code and operating documentation were updated together.

Verification: G6 TLS/record suites **11/11 PASS**; actual DB socket encrypted/authorized; invalid CA rejected with `SELF_SIGNED_CERT_IN_CHAIN`; actual read-only `readLive` succeeds with detector `bd-0.1.0`, sealed taxonomy and probe cap 3. No live DB mutation, test fixtures, run activation or participant recruitment occurred.

Independent code review initially reproduced `sslnegotiation` CA loss and credential-bearing URL parsing errors. The G6 wrapper corrections and regressions resolve both; final blocking review returned `NO_FINDINGS`. Code commits were pushed to `origin/feat/ec-smoke`.

## Actual blockers

- Recruitment/consent and common unseen exams have not been supplied for an actual run.
- No default private mapping or sealed actual-run metadata is present in the inspected operational worktree.
- Active-run/app-commit/participant settings are absent from the locally loaded env; production configuration is unverified.
- Same-run/deployment-commit E2E and `start-check` require these inputs. The approved protocol requires separate G6 start authorization after concrete evidence is ready.

`DEV_ADMIN_USER_ID present` was confirmed; its value, prefix and hash were not stored. Admin/test identity does not satisfy participant requirements. These blockers cannot be resolved by inventing run data or replaying closed G3 checks.

The operator question about already-prepared inputs remains pending. No additional permission question for routine implementation was introduced; real Pilot activation remains subject to the existing protocol §20.

## Documentation and Git

- New canonical index: [GATE_STATUS.md](../csat-learner/GATE_STATUS.md).
- Public metadata evidence: [csat-next-gate-readiness-20261007.json](csat-next-gate-readiness-20261007.json). It contains presence/status and code references, not participant identities or env values.
- G6 TLS correction: `feat/ec-smoke` commits `2a3541b9a`, `da2b17730`; source and README/CHANGELOG together.
- Detailed real TLS receipt remains ignored at `D:/workspace/Vocaflow-ec-smoke/tmp/g6-readiness-20261007/live-probe.json`.

No broad G3 review/build/test loop, automatic sibling merge, live migration or actual Pilot start was performed.
