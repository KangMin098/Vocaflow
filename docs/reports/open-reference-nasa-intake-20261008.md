# NASA quadcopter reader: first real open-reference admission (2026-10-08)

A single NASA reader passed the file-backed open-reference admission path. The metadata-only corpus is [open-reference-nasa-corpus-20261008.json](./open-reference-nasa-corpus-20261008.json), status `admitted_uncalibrated`, N=1. This proves a real-source intake path; it does not establish a grade distribution, Korean grade fit, commercial-textbook fit, Gold-S, or production readiness.

## Primary source and evidence

- [NASA catalog](https://www.nasa.gov/stem-content/the-science-behind-quadcopters/) links both source PDFs and describes a standalone informational reader with comprehension questions for US grades 6 through 8. Its broader catalog tag says grades 5 through 8; the guide's narrower 6 through 8 statement was selected and the difference retained.
- [Student reader](https://www.nasa.gov/wp-content/uploads/2020/05/aam-science-behind-quadcopters-reader-student-guide_0.pdf): SHA-256 `d1fe5133ce0636cfd1f995176fdfb9c05e3e8df7d863970acf64a8a76611fbd7`, 10 PDF pages, NASA publication `EP-2020-04-519-HQ` on page 10. The selected text consists of four prose spans on PDF pages 2, 3 and 4; the selected reading-comprehension items are questions 1 through 3 on page 8. Figures, captions and the separate "Going Further" items were excluded.
- [Educator guide](https://www.nasa.gov/wp-content/uploads/2020/05/aam-science-behind-quadcopters-educator-guide_1.pdf): SHA-256 `0a4ee9fe021d3214690f850738134079e406261e7c3e32688f23cb4b496ea708`, 6 PDF pages. Page 2 specifies grades 6 through 8; page 5 contains reader-version model answers for questions 1 through 3. The grade and scoring file is separately byte-checked at admission.
- [NASA work policy](https://nodis3.gsfc.nasa.gov/displayCA.cfm?Internal_ID=N_PR_2200_002C_&page_name=Chapter4) states that work produced by government employees as part of official duties lacks U.S. copyright protection. [NASA usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/) allow NASA material for educational/informational use and warn about third-party rights. The selected prose and questions carry a NASA issuance number and no visible third-party text credit; an agent inferred NASA origin for this text only. Employee authorship was not independently documented, so this rights classification remains a reviewable inference and does not authorize republication. Images and logos were excluded. The admission policy accepts only `nasa.gov` origins in this branch.
- Source PDFs and raw review materials are stored outside Git at `C:\Users\Administrator\Documents\영어\공개참조\NASA-quadcopters-2020`. Only metadata and hashes are tracked. Reproducing the receipt requires those exact files at the bound paths.

## Ordered execution and checks

1. The selection rules and nine-axis codebook were written before rating. The rules hash is `4f746a7a8f1ed00e77e9493b65e838ab23a26e0c4bdbbd5b6e020dd467c0e5a6`.
2. Metadata screening and the selected-ID manifest were sealed before nine-axis ratings. Moving the source from temporary storage required a new screening revision and manifest; the earlier hashes were not overwritten. The final manifest hash is `67419e0fa3671fbbe65e3d7d39cf511d4470dbe8cdb9516a1bb27abe8fc3f96e`.
3. An independent PDF extraction audit checked 14 catalog, edition, grade, passage, item and answer anchors against both downloaded files. The reviewed passage is 524 words. US grades 6 through 8 were represented as `elementary_6`, `middle_1`, `middle_2` for source indexing only; Korean curriculum equivalence is not established.
4. Two separate blind Claude Code invocations rated the nine axes from the sealed codebook and exact selected passage/items. Eight axes agreed. `processing_load` differed by one level (1 versus 2); Codex adjudicated 1 because each item uses a local evidence span. The resulting metric vector is 2 on eight axes and 1 for processing load. Both calls use the same model family. The receipt explicitly marks `calibration_eligible=false`; these are preliminary measurements, not independent-model or student validation.
5. `reference-admit.mjs` re-read the source and separate scoring/grade PDF, verified current hashes and the manifest, and produced receipt `c9dd4a6865acb2cbaa341174210c41ce523247e00bf5cdd9b188ec2b0814796f`. Eight changed-source, score, grade, rights, manifest, agreement and scope inputs were blocked in a separate failure-injection audit.

The corpus contains exactly one range-labelled open-reference passage. It does not fill any individual-grade pool or the minimum publisher, series, genre and passage quotas. `BENCHMARK_TARGET_FIT` and `BENCHMARK_LEVEL_SEPARATION` remain unopened; real calibrated nine-axis distribution is 0. Commercial benchmark corpus remains 0, Gold-S remains 0, DB seed remains 0, and `production_verified=false`.

The later calibration contract was run against this exact admission receipt without inventing
new evidence. Admission re-verification passed. The three new stages returned `hold`:
`RIGHTS_EVIDENCE_MISSING`, `GRADE_MAPPING_MISSING`, and `RATING_REVIEW_MISSING`.
The earlier rights inference and same-family ratings remain in the admission audit, but do not
meet the more demanding calibration evidence contract. The decision is stored outside Git with
the raw audit materials; calibration-eligible N remains 0.

The revised evidence-supply run exported four receipt-bound review packets outside Git under
the same NASA audit archive: rights, grade mapping, and two blind rater packets. The adjudicator
packet is deliberately withheld until both rater outputs exist, so it can include the actual
two output hashes and rating vectors. No review outputs exist yet. Import recorded five missing
outputs and the same three `hold` decisions. Earlier packet revisions remain in their
own folders; the current packets are in `calibration-work-r3`. They are work requests, not
completed rights, mapping, or rating evidence.

## Calibration review revision 3

The four receipt-bound packets were answered without changing the admitted sample. A Claude Code
blind rating and a separate Codex-agent blind rating used different model families; local
operator-reviewed invocation records bind the packet, normalized output, and recorded model
family. These records are local audit evidence, not provider attestation of prompt delivery.
The raters agreed on seven of nine axes. They differed on information density (3 versus 2)
and discourse (2 versus 1). The adjudicator chose 2 for both: the dense opening is offset by
repeated concrete physics explanations across the whole passage, while the item set requires
some cross-paragraph integration despite mostly explicit organization. Both raters scored
processing load 2, whereas the earlier sealed admission analysis recorded 1. That old receipt
remains unchanged; a new analysis and admission revision is required before the ratings can
support calibration.

The rights reviewer found no passage-level proof of NASA employee authorship or complete
third-party clearance; general NASA use guidance is insufficient for calibration rights.
The grade reviewer retained the US grade labels but found no validated Korean equivalence or
two independent mapping anchors. The create-only decision `calibration-work-r3/decision-r3.json`
therefore has no missing outputs and returns `RIGHTS_NOT_DOCUMENTED_FOR_CALIBRATION`,
`KOREAN_GRADE_EQUIVALENCE_UNVERIFIED`, and `RATING_ANALYSIS_REVISION_REQUIRED` as three independent
holds. `admitted N=1`, `calibration-eligible N=0`, real grade distribution 0, Gold-S 0, and DB
seed 0 remain unchanged. Raw outputs and review records remain outside Git.

## New sealed analysis revision

Reviewing all nine resolved axes found two differences from the original analysis, not one:
`background_knowledge 2→1` and `processing_load 1→2`. Both are unanimous in the new blind
ratings. The original bundle and admission receipt `c9dd4a6865acb2cbaa341174210c41ce523247e00bf5cdd9b188ec2b0814796f`
remain unchanged. The create-only analysis revision derives its metrics, agreement and ordinal
review rows from the verified two-rater/adjudicator record, then re-admits the same selected
passage with new receipt `cf64d602aa88a9bc29d1612dcf5813d95f5dd60608a4c8bae9dca9b4725d5d4e`.
An external lineage record binds both admission and analysis hashes, the rating evidence hash,
and the changed-axis list. Selection rules, screening, manifest, source and items remain sealed
at their earlier versions.

The revised receipt generated a new packet set in `calibration-work-r4`. Prior rights and grade
reviews were carried forward only as explicit, parent-hash-linked hold records against unchanged
source/grade evidence. Old A/B ratings and adjudication still belong to the parent analysis hash;
they are not replayed as current calibration outputs. The new decision therefore reports rights
`RIGHTS_NOT_DOCUMENTED_FOR_CALIBRATION`, grade mapping
`KOREAN_GRADE_EQUIVALENCE_UNVERIFIED`, and rating `RATING_REVIEW_MISSING`. The parent calibration
decision is stale for the revised admission. No calibrated cohort or distribution was opened;
Gold-S and DB seed remain 0.

## New receipt blind rating and adjudication

The revised receipt `cf64d602aa88a9bc29d1612dcf5813d95f5dd60608a4c8bae9dca9b4725d5d4e`
was rated from fresh, separated A/B packet copies. Claude Code and Codex CLI returned the
respective packet hashes and all nine ratings. Seven axes agreed. The two disputed axes were
`discourse` (2 versus 1) and `background_knowledge` (1 versus 0). The adjudicator retained
`discourse=2` because two questions require cross-span application despite explicit local
organization, and `background_knowledge=1` because explanations limit but do not entirely
remove the benefit of basic force-balance intuition. It did not average the scores.

The create-only decision in `calibration-work-r4/decision-r3.json` has zero missing outputs.
Its rating-independence stage is `pass`; source/passage rights remain
`RIGHTS_NOT_DOCUMENTED_FOR_CALIBRATION` and Korean-grade mapping remains
`KOREAN_GRADE_EQUIVALENCE_UNVERIFIED`. The two CLI outputs and operator-reviewed invocation
records are local audit evidence, not provider-certified prompt receipts. Codex CLI encountered
an initial shell-helper error and used an alternate local read path; its returned packet hash
matched the sealed B packet. No old-receipt rating output was imported into this decision.
`calibration-eligible N=0`, calibrated grade distribution 0, Gold-S 0, and DB seed 0 remain.

## Passage-level rights review revision 5

An external rights dossier now binds the NASA catalog snapshot, general media-use guidance,
NASA government-work policy, and the exact reader PDF by SHA-256, with selected prose on PDF
pages 2–4 and questions 1–3 on page 8. The local dossier hash is
`d0d0590cbfcf90f7543c5e1b50ddb1afdef45eda0217fa717681ff9a821f1827`.
[NASA's catalog](https://www.nasa.gov/stem-content/the-science-behind-quadcopters/) directly
links the reader, and the [reader PDF](https://www.nasa.gov/wp-content/uploads/2020/05/aam-science-behind-quadcopters-reader-student-guide_0.pdf)
shows NASA publication number `EP-2020-04-519-HQ`. NASA's
[media guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/) permits many
educational uses while warning that NASA may publish third-party material without conveying
downstream rights. None of these sources identifies the selected prose/question author as a
NASA employee acting in official duties or supplies passage-specific third-party clearance.
The responsible NASA official named on the catalog page is a page responsibility marker, not
authorship proof. A further search for the publication number found no official authorship
record. The dossier therefore records `source_rights=unknown`, `passage_rights=unknown`,
`third_party_content=unknown`, and `rights_confidence=reviewed_inference`.

The create-only `calibration-work-r5/decision-r2.json` has no missing outputs and keeps
`rights=hold`, `grade_mapping=hold`, and `rating=pass`. The rights dossier and reader PDF hashes
are rechecked even while rights remain held. Passing the rights gate would require a
passage/question-specific NASA rights statement or equivalent written clearance that addresses
authorship and third-party material; the publication number or generic guidance alone does not
satisfy this protocol. Calibration eligibility, real Korean grade distribution, Gold-S, and DB
seed remain closed.
