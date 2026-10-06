# Reveal Gate G3 closure — 2026-10-07

**Track B: CLOSED. DB deployment gate: PASS with an authorized evidence waiver. G3: CLOSED.**

This closes the three items left in [the 2026-10-06 report](reveal-gate-db-deployment-20261006.md). Earlier failed receipts remain preserved. Application code, automatic scanner policy, production builds and live migrations were not changed or rerun for this closure.

## Historical snapshot waiver

The actual predeployment snapshot is unavailable because migration application preceded snapshot capture. It was not reconstructed or relabeled from the current DB. The user explicitly authorized `WAIVED_WITH_COMPENSATING_EVIDENCE` on 2026-10-07.

Compensating evidence: reviewed local/applied migration hashes and documented semantic differences; isolated PostgreSQL 349/349; real direct permissions 72/72; real actor/API/fault checks 55/55; successful cleanup. Current-state comparisons are not historical before/after evidence.

## GraphQL scope and actual access

The source scan of `apps/web/src` and `packages` finds no Supabase GraphQL endpoint/client call. Two general `graphql` mentions are comments about external TED robots restrictions. Student Reveal uses the previously verified REST/RPC/server routes; direct GraphQL bypass still required separate verification.

Targeted real probes passed **27/27**, including preparation, seven-finding checks, bundle identity and cleanup. Broad code/test/build checks were not repeated.

- `csat_dx_response` is **in scope and verified**: the real learner schema excludes `is_correct`; a positive held response fixture exists, but its owner receives zero GraphQL rows under owner/embargo RLS.
- `csat_dcp_items` is **learner-unreachable with evidence**: enabled RLS permits SELECT only through `is_admin_or_curator()`. The actual learner predicate is false. Service reads an existing row; anon and learner receive zero rows for that same primary key with all their visible scalar fields selected.
- `csat_source_eligibility` and `csat_source_eligibility_history` are **administrator source operations outside student Reveal**. Exclusive administrator policies and service-positive/learner-zero same-row probes establish the boundary.
- `csat_item_reviews` and `csat_item_state` have enabled RLS and no learner SELECT policy. Valid actual learner GraphQL requests return zero rows without the previous UUID/text filter mismatch.

The prior unfiltered administrator-table requests retain HTTP 500 / SQLSTATE 57014 timeouts. They are neither PASS nor DENY. The bulk-query availability issue is non-blocking for G3 because those surfaces are not student Reveal routes or learner-readable answer surfaces, as verified above. General GraphQL performance is not declared fixed.

## Seven Advisor dispositions

| Finding role/object | Disposition | Evidence |
|---|---|---|
| anon / `csat_dcp_items` | EXPECTED | Admin-only RLS; service-positive and anon-zero same-row query |
| authenticated / `csat_dcp_items` | EXPECTED | Real admin predicate false; service-positive and learner-zero same-row query |
| authenticated / `csat_dx_response` | EXPECTED | Correctness column absent from learner schema; positive held fixture returns zero rows |
| authenticated / `csat_item_reviews` | EXPECTED | RLS default deny; valid learner query returns zero rows |
| authenticated / `csat_item_state` | EXPECTED | RLS default deny; valid learner query returns zero rows |
| authenticated / `csat_source_eligibility` | IRRELEVANT_TO_G3 | Admin source operations; current RLS and same-row access restriction verified |
| authenticated / `csat_source_eligibility_history` | IRRELEVANT_TO_G3 | Admin source operations; current RLS and same-row access restriction verified |

Fresh Management API Security Advisor retrieval accepts the earlier 98 per-key dispositions plus these seven: **ERROR 0, G3 blocking 0, seven-finding disposition complete**. No historical `PREEXISTING` or no-new-warning claim is made. Findings need not disappear to be explained/non-blocking.

## Evidence and limits

The separate committed DB closure manifest is [reveal-gate-g3-closure-20261007.json](reveal-gate-g3-closure-20261007.json). It references frozen code and DB receipts rather than combining results. Detailed local evidence is ignored under `tmp/reveal-db-deployment/`: `seven-manifest.json`, `seven-results.json`, `seven-notes.json`, `seven-provenance.json`, `advisor-seven-triage-20261007.json`, `advisor-closure-20261007.json`, and `g3-close-20261007.json`.

Owned TEST exam/items/active tombstones and accounts were cleaned up; checkpoint issues are zero. Temporary local PostgreSQL directory cleanup remains deferred and non-blocking.

Legacy automatic DB CLI requirements for a historical before snapshot and whole-surface checks were not silently weakened. Old BLOCKED receipts remain valid records of those stricter checks. This closure is an explicit authorized waiver and evidence-based scope/disposition decision. No main merge is performed.
