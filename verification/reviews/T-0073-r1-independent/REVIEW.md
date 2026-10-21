<!-- verification/reviews/T-0073-r1-independent/REVIEW.md -->
# T0073 rev1 — code accepted with limits; authenticated test correction

HEAD 2e4189a0ae90210a5c8cbccc3e8920f334dc888b: **product code ACCEPT_WITH_LIMITS**. Independent original SSR probe3/3 and focused no-record/map-state/next-action29/29 pass, skip0. Original E01/E02 hashes match. E01 actual log1335pass/2skip is accurate; the two named live files are not task paths and are not counted as passing. No in-scope product P0/P1 found. Existing rank, goalMismatch, storage, G2 and qualification are unchanged. Initial missing-action failure remains preserved.

**P1 validation-path correction, not a newly alleged product defect:** authored authenticated map-no-record-start test is NOT_VERIFIED and has two contradictory assumptions. Correct only these in the same T0073/rev1 before spending official CI:

1. Before the first attempt it expects `umap-top-next data-kind=start`. Actual existing NextActionButton start branch renders an anchor with href/data-task and no data-kind. Assert the actual anchor, same TASK, valid authored href and map-return context. Do not add a product marker merely to satisfy the test.
2. The final `openMap()` still requires no_record and the pre-evidence note. Existing T0070 mapStateOf intentionally leaves no_record when valid direct_check evidence appears, even while exam sessions remain0. Parameterize only the before/after expectation; after the first eligible attempt assert direct_check/checking as appropriate, evidence1, exams0, not resolved/mastered, preserved goal/PLAN history and same Workspace. Do not weaken or remove the first-entry checkpoint.

Keep actual supply API, independently scored response, first-exposure/G2 and return/history assertions. Make a test-only follow-up commit; preserve current product code. This is continuation of the same verification work, not another task or new gate.

Official integration timing: after these corrections and related local checks, use **this existing branch as the next official integration bundle** (main target, current T0073 scope; one PR/CI, no force/direct-main push). There is no other final-product READY code to wait for, and authenticated first-entry/return cannot be verified locally without isolated Supabase. Do not use workflow_dispatch/shared-dev. Do not change safe-merge, CI or approval policy. Return exact tested HEAD, run/attempt and actual1440/1280 results. Preserve foreign audit edits. Final completion/merge awaits genuine authenticated evidence; actual DB/Gold/rights remain separate.

Task is returned through the existing REWORK/READY route only so the owner can make this scoped test correction. Product scope acceptance is not revoked or relabelled as a product regression. Do not rerun unrelated successful coverage.
