<!-- docs/csat-learner/codebook/REVEAL_GATE_VERIFICATION.md -->
# Reveal Gate verification

`pnpm reveal-gate:verify` runs classification, mutation tests, behavioral tests, paging diff, a fresh production build and actual client bundle inspection. It exits nonzero and reports `BLOCKED` if any required layer cannot run. Reports are written under ignored `tmp/`; credentials are never copied into reports.

```sh
pnpm reveal-gate:verify --phase pr --base origin/main
pnpm reveal-gate:verify --phase merge --base origin/main
pnpm reveal-gate:verify --phase db --base origin/main --live --before tmp/reveal-before.json --snapshot-out tmp/reveal-after.json
```

Use the actual PR target as `--base` (this feature targets `feat/ec-reveal-app`). PR checks are fast. Merge checks additionally build from current sources and scan `.next/static`; an old bundle cannot substitute for a failed build. The dedicated Reveal Gate GitHub workflow runs the merge phase for main and EC feature PRs.

V1 discovers sensitive `.from`/`.rpc` reads and CSAT handlers using the TypeScript AST. Existing manifest classifications are frozen by function body and import/binding hashes in `verification-policy.json`. New or changed functions need explicit classification review. Merely importing a gate, or mentioning its call in a comment, does not satisfy coverage. This is a discovery and review guard, not a complete interprocedural data-flow proof.

V2 follows client imports, barrel exports and literal dynamic imports. It checks answer-bearing content, including renamed JSON, trap examples and serialized JSON inside JavaScript strings. Mutation tests deliberately introduce these leaks and known secret canaries. The actual production bundle is inspected separately. Source traversal covers `apps/web/src`; compiled package dependencies are covered by bundle inspection. Unknown dynamic imports block verification.

V3/V4 exercise the real reveal POST route, actual reveal loader and gate with injected DB transport. All 64 correctness combinations keep sealed targets unchanged. Choice changes have identical held response body/status/content-type/cache headers. Anonymous access is denied, and global exam embargo denies every learner actor even if their own capture is completed. Timeout, transport failure, HTTP 500 and malformed/out-of-scope RPC arrays return held responses before secret reads. Timing equivalence is not claimed by deterministic unit tests.

V5 DB checks require real dev credentials, a pre-deployment snapshot and a Management API token for Security Advisor. Missing inputs are `BLOCKED`. A successful merge phase records source/build/artifact hashes. The live phase validates this attestation and starts its own local production process from those artifacts; an arbitrary external app cannot substitute for it. The read-only preflight can write a baseline snapshot even when the deployment verdict is blocked by a missing `--before`. Compare snapshots across the actual deployment; never fabricate a before snapshot from the after state. Diff includes column privileges/RLS, policies, function EXECUTE/security-definer/config/body hashes. Allowed changes need exact before/after and a recorded decision/reason. Migration file hashes and deployed versions are recorded.

`--live` explicitly enables the existing controlled dev canary with temporary users and owned TEST fixtures. DB health checkpoints are recorded before and after. An old receipt, empty receipt, failed cleanup, missing actor or skipped required area cannot count as success. The command never applies a migration to live Supabase. The live canary currently proves embargo paths; completed-state SQL is tested separately in the isolated cluster. No assertion of comprehensive live completed-state coverage is made.

V6 runs the existing SQL migration/state/concurrency/integrity tests in a fresh local PostgreSQL cluster, with a unique directory and port. It stops and deletes only that cluster. The watermark-based snapshot worker is tested for held suppression, recomputation, failure and retry; worker failure never changes capture completion. This consumer uses an input watermark rather than directly consuming the restricted outbox table.

V7 compares AST paging calls against the PR base. It reports added and removed sites; net growth requires a per-site architecture decision. There is no global hardcoded count. Its unit is calls with nonliteral `.range` offsets, which differs from the legacy textual paging scanner.

Local evidence on 2026-10-06: PR phase passed; scanner/deployment unit tests 10/10, route/gate/target tests 41/41, snapshot worker tests 4/4 and isolated PostgreSQL tests 349/349 passed. A fresh production build and actual bundle inspection passed. Live deployment remains a separate gate; these numbers do not close it.

The registry also freezes server CSAT pages (including route groups) and modules that import sensitive loaders. New pages and changed caller bodies cannot bypass classification by rendering a sensitive helper directly. Build proof includes `.next/server` and deployment manifests as well as static assets. New/changed CSAT migrations are discovered against the base; their exact hashes must be in the isolated runner's approved input list. The runner applies approved extra SQL in its local cluster before executing the state/ACL/integrity suites; unbound SQL blocks the merge gate.

Reruns are safe for PR/merge and isolated SQL. A per-worktree process lock prevents overlapping verification phases from invalidating shared receipts/build output. Avoid concurrent live canaries across worktrees because the inherited live fixture uses the fixed TEST exam `M2099`. Production builds and DB reports are separate from source-origin Books experiments. Configure the GitHub Reveal Gate verification check as a required branch-protection status before relying on it to prevent merges.
