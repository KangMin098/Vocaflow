# Reveal Gate DB deployment — 2026-10-06

Track B code gate: **MERGEABLE / CLOSED**. DB deployment gate: **BLOCKED**. G3: **OPEN**.

Historical status above is superseded by [G3 closure on 2026-10-07](reveal-gate-g3-closure-20261007.md): explicit snapshot waiver, targeted GraphQL proof and seven individual non-blocking Advisor dispositions. Original receipts and failures remain preserved.

## Verified

- Existing Management API credential works (HTTP 200); only credential presence/source is recorded.
- The official Supabase CA verifies the actual PostgreSQL client socket and hostname. No TLS verification exception was used. The pooler's backend `pg_stat_ssl` value is separate from the verified client TLS connection.
- Migrations `20261005170000` and `20261005170100` are deployed. Local/applied raw hashes are retained and differ; they are not presented as equal. For ②, the body matches after removing deployment transaction wrappers. For ①, the permission/function section matches; the recorded array-literal versus ARRAY-expression difference leaves the actual 68-event constraint equivalent.
- Real anon/authenticated/service direct SELECT probes: **72/72 PASS** across 24 sensitive columns per actor. Actual denial is SQLSTATE 42501: anon HTTP 401, authenticated HTTP 403; service HTTP 200.
- Dedicated real actor/HTTP transition probes: **55/55 PASS**. Held reveal returns 423 with no-store and no answer payload; another participant cannot finish/read the owner's session. Completion uses actual learner RPCs. A completed learner remains held while another participant is collecting, then receives normal reveal and its own score after both complete. Completed learners still cannot directly SELECT restricted columns. Service access works.
- Actual production HTTP probes with injected RPC 500/429/reset/malformed/timeout all return 423 with no-store. They do not roll back completed capture state.
- Owned TEST items, exam, active tombstones and test accounts are all **0** after cleanup. Before/after DB health checkpoints are present; missing checkpoint axes: 0. Temporary local PostgreSQL folders remain deferred and do not block G3.
- The postdeployment snapshots before and after verification have **0 permission/policy/function changes**. This proves verification-time stability, not historical deployment differences.
- Fresh code merge verification passed production build and actual bundle scan separately, plus 14 scanner/deployment tests, 43 route/gate tests, 4 worker tests and 349 isolated PostgreSQL checks. Independent review: `NO_FINDINGS`. Code revision: `1977560c8` on `feat/ec-reveal-app`; no main merge was performed.

## Remaining deployment gate

1. **Actual predeployment snapshot is missing.** The current catalog snapshot cannot be relabeled as a historical before snapshot. The current preflight's only issue is `missing_before_snapshot`.
2. **Comprehensive GraphQL proof remains BLOCKED.** Its failed receipt is preserved (357 PASS / 14 FAIL); the separate 55/55 actor proof does not convert it into PASS. UUID filter and extension-fixture issues were corrected. Authenticated requests to `csat_dcp_items`, `csat_source_eligibility` and `csat_source_eligibility_history` independently reproduced HTTP 500 / SQLSTATE 57014 (`statement timeout`). Supplemental anonymous GraphQL checks passed 27/28, with the same timeout on `csat_dcp_items`. These failures are not counted as zero exposure or successful verification.
3. **Security Advisor: ERROR 0, WARN 467, INFO 58.** Of 105 CSAT warnings, 98 have item-specific expected dispositions backed by actual catalog/function definitions and role probes. Seven remain unresolved: anon/authenticated `csat_dcp_items`; authenticated `csat_dx_response`, `csat_item_reviews`, `csat_item_state`, `csat_source_eligibility`, `csat_source_eligibility_history`. The `csat_dx_response`, `csat_item_reviews` and `csat_item_state` entries retain failed/missing role-specific GraphQL proof; no blanket allowlist or historical no-new-warning claim is made.

No live migration was applied in this follow-up. G3 must remain OPEN until the remaining evidence and deployment checks pass.

## Separate evidence

All local receipts are under `tmp/reveal-db-deployment/` and are intentionally ignored by Git. The deployment manifest references the code receipt rather than combining their results.

- `g3-db-deployment-final.json`: final deployment status and blockers.
- `code-reclosed-1977560c8.json`, `production-reclosed-1977560c8.json`, `uuid-review.log`: frozen code gate evidence.
- `real-direct-actors.json`: 72 direct SELECT checks and checkpoint diff.
- `transition-manifest.json`, `transition-results.json`, `transition-provenance.json`: dedicated 55-check actor/HTTP proof, fixture cleanup and transport-injection hashes.
- `live-attempt-2-manifest.json`, `live-attempt-2-results.json`: preserved failed comprehensive canary.
- `current-preflight.json`, `verification-permission-diff.json`: current ACL checks and explicitly postdeployment comparison.
- `migration-hashes.json`, `migration-semantics.json`: deployed/local migration evidence.
- `advisor-final.json`, `advisor-dispositions.json`, `advisor-catalog.json`: fresh advisor result, per-key decisions and actual policies/function definitions.

Earlier failed transition attempts are preserved as `transition-attempt-1-*` and `transition-attempt-2-*`; corrected harness/fixture failures are not omitted from the history.
