<!-- verification/reviews/T-0068-r1-independent/REVIEW.md -->
# T-0068 rev1 · exact-head independent preview review

HEAD `8ec7d978d94217fd2a85c5b95e16e86eb5e13111`, base `9ba70cfcca6fb197b8e9fa966a19c1812835c52f`. **REWORK for two content P1s.** Original owner has not formally submitted this run; its official status remains IN_PROGRESS. This is a requested implementation-preview judgment, not a forged task rejection/completion.

Actual original Claude session ACK was received through the user's packet: c513ff5b/PID22712, same worktree/task/revision. New PR324 observed at this exact HEAD; creating this official integration PR was cleared through the existing inbox. Its isolated browser tests remain NOT_VERIFIED at this checkpoint. No shared-dev dispatch, production-source modification, DB write or human Gold/rights approval by Codex.

## Minimum same-task corrections

- **P1 T0068-P1-1 — gs-ind-3:** `Dogs ... need to be walking every day` admits a grammatical active progressive interpretation: the dogs need daily walking activity. The intended passive `to be walked` is another possible meaning, not a mandatory grammatical correction. The stem requires a uniquely ungrammatical underline, but this passage does not supply one. Current product grading nevertheless calls choice2+voice correct. Change only this candidate's passage/mark/Gold/explanation into an unambiguous single-error item. Retain old six items and the unchanged grader.
- **P1 T0068-P1-2 — sc-transfer-2:** the main-clause identification is correct, but the passage teaches that high-altitude bread needs more yeast. [Colorado State University Extension, Baking at Elevation](https://extension.colostate.edu/resource/baking-at-elevation/), Baking Yeast Breads, explains the faster rise and recommends less yeast. [King Arthur's guide](https://www.kingarthurbaking.com/learn/resources/high-altitude-baking) independently agrees. Correct the claim (and matching segment text/explanations) while retaining the infinitive-subject/embedded-relative/main-verb target. Refresh that candidate's package hash; leave human decisions pending.
- **P2 follow-up:** df-ind-4's Seoul two-month/one-third result and rel-ind-4's forty-minute research threshold have no supplied source. Clarify invented examples as hypothetical rather than presenting precise empirical findings. No new audit/document gate is required.
- **P2 follow-up:** four non-live core Workspaces label missing transfer stock `no_content`. Current ranksOf converts this to content_gap and nextActionOf supplies an actionable supply CTA. All13 PGlite cycles actually supply and progress. Thus this is not a demonstrated P0/P1 path break; retain canon readiness and leave the narrow PLAN wording improvement for later. Do not weaken the supply/phase assertions.

## Direct content inspection, all39 additions

Indices below are zero-based; judgments were made from the full text and explanations, separately from adapter self-consistency. Nonflagged content remains AI-reviewed candidate material, not human-approved Gold or verified empirical research.

| Set | New items / independent judgment |
|---|---|
| option correspondence | opt-ind-3=2: cash-only contradicts cards; opt-ind-4=4: sold album contradicts free copies; opt-transfer-2=3: original ice-safety purpose. Option verdict/sentence pairs match. |
| discourse function | df-ind-3: myth/rebuttal and bat examples; df-ind-4: food-waste problem/solution, factual framing P2 above; df-transfer-2: request act then closing. Declared role alternatives retained. |
| discourse structure | ds-ind-3: narrative, dependency loss as turning point, topic/conclusion alternative; ds-ind-4: staffing problem/solution; ds-transfer-2: wet-hair myth/rebuttal, concession/support alternative. |
| inference | inf-ind-3=2: founder refuses delegation, sentences0/3 suffice, recommendation5 alone need not establish refusal; inf-ind-4=1: silent middle omitted; inf-transfer-2=4: fines kept borrowers away. |
| reference | ref-ind-3=1: copy-free room visitors, antecedent3; ref-ind-4=3: monoculture pest spread, antecedent3; ref-transfer-2=4: latter book-closed recall, antecedent1. |
| sentence relation | rel-ind-3: contrast/cause-effect/example; rel-ind-4: restatement/addition/conclusion with causal alternative, framing P2 above; rel-transfer-2: reverse-order cause/sequence/contrast. |
| chunk boundary | cb-ind-3=1: end of whether subject clause; cb-ind-4=3: main subject after when clause, alternative main_subject legitimate; cb-transfer-2=2: end of subject including reduced relative, restored-ellipsis alternative legitimate. |
| form scope | gs-ind-3=P1 invalid single-error task; gs-ind-4=4: comparative do instead of are; gs-transfer-2=3: complete noun clause requires that rather than what. |
| sentence core | sc-ind-3=4: has risen, not relative/subordinate verbs; sc-ind-4=1: captain head subject; sc-transfer-2=3: takes main verb, factual claim P1 above. |
| structural relation | sr-ind-3=4: final coordinated infinitive; sr-ind-4=3: if(it is)necessary; sr-transfer-2=1: parenthetical the mayor insists. |
| contextual sense | vcs-ind-3=1: check=restrain; vcs-ind-4=3: runs=manages; vcs-transfer-2=0: observe=comply. Context and distractor senses match. |
| multiword | mw-ind-3=1: devise; mw-ind-4=3: exhaust stock; mw-transfer-2=0: investigate. Context distinguishes literal/nearby expressions. |
| semantic relation | sem-ind-3: vital/essential synonym; sem-ind-4: prompt/sluggish contextual antonym; sem-transfer-2: Wednesday included in weekdays, unequal scope. |

## Actual verification and limits

- Independent frozen-HEAD probe **55/55, skip0**: exact19files/13sets/39additions; original six JSON objects AND literal item-prefix preservation; correct roles; validation; human status pending; all13 package hashes; unique whole-text/group in entire17-set corpus; learner payload concealment; independent answer indices; segment reasons/alternatives and wrong-chunk+right-reason rejection; saved no_content→content_gap→supply path. Defective gs-ind-3's existing grade is deliberately reproduced, not counted as semantic correctness.
- Submitted focused files independently executed **61/61, skip0**: PGlite actual SQL/server/supply/G2/MAP/PLAN44 plus adapter17. Includes13TASK pass/fail, first independent bindings retained and new-repair old-guided-success not inherited. Gold-derived adapter responses cannot prove Gold's educational truth.
- No rerun of unrelated full web tests/type/lint; author's reported508 files/tsc/lint are not relabeled independent execution. Authenticated browser four new paths were written but were unrun at receipt; official PR324 CI is the authorized environment and not yet accepted.
- Same-task requested fixes are limited to two appended candidates and their exact-byte approval package; no new revision/task/engine/SQL/canon change. Original failing artifact is this commit's Git content. Preserve before/after review and actual CI failure history.
- Overall FINAL mission remains REWORK; release/actual database/content rights/Gold/learner effectiveness remain separate. Existing foreign audit files and local/integration ownership were preserved.

Reproduction: run the included probe.config.mjs with product web's vitest. Source tests: `src/lib/knowledge/__tests__/authored-responses.test.ts` and `src/lib/csat/authored/__tests__/authored-flow.pglite.test.ts`. Actual independent owner final-independent-accept, Codex session01a14de8-2485-7a53-b530-d5612f35e57a/PID31380. Handoff is LOCAL_INBOX_POSTED; subsequent correction ACK/start not inferred from that file.
