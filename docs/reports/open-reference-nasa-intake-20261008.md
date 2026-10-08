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
