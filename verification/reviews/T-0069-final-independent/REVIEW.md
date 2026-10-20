<!-- verification/reviews/T-0069-final-independent/REVIEW.md -->
# T-0069 rev1 final independent acceptance

HEAD `a14ab5ecdc86baeec84d076f789386985ee0c36f`, base `25566801020cc40ed6cd5d3b2bf45615b023989d` · **ACCEPT_WITH_LIMITS** for V1's existing vocabulary learning roundtrip. No unresolved P0/P1 identified in this scope. Earlier same-head code verification is reused; no unchanged unit/full-suite rerun.

```json
{
  "task_id":"T-0069",
  "design_revision":"rev1",
  "head":"a14ab5ecdc86baeec84d076f789386985ee0c36f",
  "verdict":"APPROVE",
  "decision":"ACCEPT_WITH_LIMITS",
  "findings":[],
  "ran_tests":true,
  "verification":{
    "independent_probe":{"passed":14,"failed":0,"skipped":0,"reuse":"same-head preview;actual server-page read/auth/error/empty controls, fixed map destination, old authored receipt removal, existing CSAT context preservation"},
    "related":{"passed":20,"failed":0,"skipped":0,"reuse":"same-head preview, includes12 submitted and8 existing map-return tests;not32"},
    "ci":{"run":"39477451406","head":"a14ab5ecdc86baeec84d076f789386985ee0c36f","event":"pull_request","attempt1":"failure;28pass/1fail;both new V1 paths pass","attempt2":"success;29/29","shared_dev":"skipped;notpass"},
    "transport_failure":{"location":"existing authored-format-cycle option_correspondence1440;commit helper line60 called at test line144;later PLAN check_result POST","error":"read ECONNRESET","cause":"NOT_ESTABLISHED;not established as first API/startup issue or proven harmless infrastructure","prior_observation":"39461175124 socket hang up;retained follow-up,no generic retries or test weakening"},
    "authenticated_browser":"actual own isolated account/vocabulary, keyboard map→V1 WordVault review→meaning/example/self-rating→learning_records/review_count increase→same Workspace return at1440/1280;CSAT attempts,G2 bindings,goal and plan row counts unchanged;no authored receipt in return URL",
    "artifacts":{"matched":4,"screenshots_matched":53,"new_v1_attachments_mapped":6,"captures_opened":[32,39,6,27],"note":"existing Playwright report decoded to connect V1 capture names/hashes;no new local authenticated browser or full visual/a11y rereun claimed"},
    "scope":{"files":9,"commits":1,"full_pagination":true,"double_metadata_stable":true,"local_remote_equal":true},
    "protected_dry_run":"current origin/main policyv1.2 exactHEAD/base/9paths/1commit;all8requiredchecks pass",
    "unchanged":"API,SQL,canon,CSAT grading/evidence/PLAN engines,16TASK learning cycles and WordVault storage mechanism"
  },
  "provenance":{"contract":"local-roles/1","task_id":"T-0069","head":"a14ab5ecdc86baeec84d076f789386985ee0c36f","implementer":"claude","reviewer":"codex","owner":"final-independent-accept","process_id":31380,"session_id":"01a14de8-2485-7a53-b530-d5612f35e57a"},
  "limits":["V1 practice is not a new direct assessment or CSAT independent/G2/resolved/retention evidence","Empty-vocabulary collection subflow and session-expiry map-context preservation remain nonblocking follow-up","No developer DB write or SQL application","No human Gold/rights approval or actual learner-effect evidence","Repeated transport reset retained with unknown cause","Task acceptance is separate from actual protected merge and whole FINAL completion"]
}
```

The actual fetchStudyVocabularies throws on error, so the new map-source page distinguishes failure from empty success and preserves the signed-in-user query. Existing general-entry behavior remains. The queue is priority+cap; no due-only count is invented. Existing map return parsers and fixed internal vocabulary route are reused; incoming old authored map_item/map_attempt are dropped. WordVault's own FSRS self-rating persistence remains an educational activity.

Actual attempt-specific logs were inspected separately: gh's job-log fetch without --attempt initially selected latest logs even for the earlier job; explicit attempt1/2 corrected the inspection. First28/1 and later29/29 are now both preserved. The assertion layer did not change between retries. The test snapshot counts are not a new claim about global DB immutability; unchanged source and existing contract tests provide the broader guard reuse.

Frozen accepted review bytes must not be updated after task completion. Actual completion, public review, merge and further A~H findings are separate receipts. Foreign audit files and local/integration were untouched. No global workflow/permission rule was relaxed.
