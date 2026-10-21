<!-- verification/reviews/PR328-final-independent/REWORK.md -->
# T-0072 rev1 integration counterexample

HEAD `56b166a0fcbf1957d9106e352ed32b58f1839c30` -- **REWORK**, P1 T0072-P1-2. Earlier five original probes and eight component controls remain passed; do not reimplement them.

New counterexample: current goal11, latest saved PLAN goal10, same stage/count, but no actionable activity because the current-stage authored material is absent (`actionRank=[]`, notActionable r.central_meaning/content_gap). Actual `nextActionOf` returns supply without replan information. Expected current-goal confirmation (`kind=plan`, `replan=true`, `replanWhy=goal`) before proceeding under that old-goal PLAN. Normal control with goal10 unchanged returns supply correctly. Actual independent Vitest: one counterexample failed / one normal control passed / skip0. Files are `D:/workspace/Vocaflow-final-independent/tmp/pr328/no-material-goal.test.ts`, `probe.config.mjs`, `no-material-probe.json`. The JSON proves an assertion failure; pnpm's trailing misleading command-not-found text is not treated as the product failure.

Root cause: goalMismatch/replanNeeded is only checked inside `if(first)`. The material-shortage/no-action path falls through to supply without examining the goal binding. This is the same target-goal-to-PLAN experience, not an API/RLS/SQL defect. Official goal-plan-version also starts from a plan without explicitly supplying authored content; its full authenticated result is still pending. Do not claim an authenticated failure until it arrives.

Minimal fix: check the goal-only mismatch before choosing either a start or a supply/wait path, preserving no-plan behavior, genuine canon-hold semantics and unchanged-goal shortage => supply. Reuse the existing predicate and reason. Add the changed-goal shortage and unchanged-goal control. Do not globally redefine content drift or change API/SQL/Gold/evidence. P2 false content-drift wording may be corrected while editing the same display condition, but do not broaden work.

Keep same T-0072/rev1, implementation owner final-product, same session/worktree. Existing PR328 and official run39551480304 are now real; do not create another PR. Preserve this first run's eventual result. A new product HEAD needs its own official required checks; reuse unchanged tests/code scope. Return actual ACK, minimum patch HEAD and focused tests. No new task, worker, orchestration, DB write or human approval.

## Official result received after the initial counterexample

Run39551480304/attempt1 has now finished: **31 passed / 2 failed / 0 skipped / 0 flaky**. Both failed tests are T0072 goal-plan-version1440/1280 at line51: the goal-change note is absent. Actual authenticated error-context shows the top button is `자료 받으러 가기`, confirming the independent no-material branch. Build/verify/TypeScript/faultclosed passed. Official artifact and log are preserved under `D:/workspace/Vocaflow-final-independent/tmp/pr328/` (`inspection.json`, `e2e.log`, `artifact/`). Earlier pending statements above record the initial audit time; they do not override this observed result.

Also keep the final no-content normal behavior honest: after current-goal confirmation, a task with no delivered material should show the actual next supply action, not invent an activity hyperlink. The test's last expected activity link requires available material; either explicitly exercise actual supply and any genuinely required content reconfirmation before that assertion, or assert the genuine no-material supply state and describe that scope. Keep the goal-change/append-only assertions strict. Do not seed a fake count, skip tests, increase timeout, or weaken the failing goal-change checkpoint.

```json
{"task_id":"T-0072","head":"56b166a0fcbf1957d9106e352ed32b58f1839c30","decision":"REWORK","verdict":"REQUEST_CHANGES","findings":[{"id":"T0072-P1-2","severity":"P1","scope":"in","message":"Changed goal with material shortage bypasses goal PLAN reconfirmation because the mismatch check exists only under an actionable first activity."}],"verification":{"counterexample_failed":1,"normal_control_passed":1,"skipped":0,"authenticated_browser":"PENDING"},"provenance":{"implementer":"claude","reviewer":"codex","owner":"final-independent-accept"}}
```
