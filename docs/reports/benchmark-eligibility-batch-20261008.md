# Real benchmark eligibility batch — 2026-10-08

This batch sought one `CALIBRATION_REFERENCE`-eligible open passage or one eligible Korean textbook passage. **Neither threshold was met.** It is a read-only evidence screen. The earlier sealed inventories, screening revisions, sample manifests, admission receipts and ratings were not edited. No new nine-axis rating was commissioned because every newly considered candidate failed an upstream evidence gate.

## Decision rule

A catalog listing, public download or foreign grade label does not by itself establish an admissible passage. This screen applied the existing [provenance protocol](./benchmark-provenance-protocol-20261008.md), [reference admission contract](../../scripts/textbook/frym-benchmark/reference-admission.mjs) and [calibration contract](../../scripts/textbook/frym-benchmark/README.md): exact file/edition; permitted analysis of the selected passage **and** items; verified grade scope; passage/item/key boundaries and grounding; independent nine-axis evidence; and, for Korean-grade calibration, a separate Korean mapping. A failed upstream gate blocks selection and rating rather than being filled with a guessed value.

## Open-reference batch

| Source | Positive evidence | Blocking evidence and result |
| --- | --- | --- |
| [BC Reads Level 5](./bc-reads-admission-and-korean-cohort-20261008.md) | 2015 Reader/Course Pack file and interval hashes, 590/590 passage tokens, 423/423 item tokens and 15/15 keyed answers matched. | Items 1c, 3e and 4c are not sufficiently grounded; passage-level rights receipt and Korean grade mapping are absent. `hold_before_admission`; prior rating stays provisional. |
| [NASA admitted passage](./open-reference-nasa-intake-20261008.md) | One real open-reference admission and revised independent rating exist. | The passage's employee authorship/third-party clearance and Korean mapping remain held. `admitted_uncalibrated`, not a second admission or calibration pass. |
| [Frontiers for Young Minds](./open-reference-alternative-screen-20261008.md) | [Publisher guidance](https://kids.frontiersin.org/participate/authors) defines 8–11 and 12–15 target bands; [publisher reuse statement](https://www.frontiersin.org/news/2017/07/05/frontiers-for-young-minds-using-frontiers-for-young-minds-articles-in-your-classroom) describes CC BY articles. | The screened article has no article-specific confirmed age band plus source item/key set bound to the same edition. No Korean mapping. `hold`. |
| [African Storybook](./open-reference-alternative-screen-20261008.md) | The screened viewer shows creator attribution, CC BY, story and questions. | Reading level is not a Korean school grade; a verified scoring key and stable edition/boundary seal are missing. `hold`. |
| [EIA Energy Kids](./open-reference-alternative-screen-20261008.md) | The screened lesson specifies US grades 6–8 and questions; [EIA reuse guidance](https://www.eia.gov/about/copyrights_reuse.php) covers agency works subject to third-party material. | Question-to-reading-page version, selected-text third-party scope and Korean mapping are unresolved. `hold`. |
| [OpenSciEd middle-school curriculum](https://openscied.org/commercial-license/) | Grade 6–8 materials and assessments offer a promising structural match. | OpenSciEd says classroom curriculum since 2023-10-18 is CC BY-NC and its commercial license includes AI-tool conditions. A particular pre-/post-change unit, covered passage/items and applicable commercial/AI permissions have not been fixed; no Korean mapping. `hold_rights_and_edition`. |
| [Core Knowledge CKSci Grade 6](https://www.coreknowledge.org/free-resource/cksci-unit-1-light-and-matter/) | Student Reader, work pages and teacher guide are linked for the same Grade 6 unit. | The [unit teacher guide](https://www.coreknowledge.org/wp-content/uploads/2022/03/CKSci_G6U1_TG_Web.pdf) distinguishes earlier OpenSciEd CC BY content from Core Knowledge additions licensed CC BY-NC-SA. Selected passage/item provenance and permitted scope have not been separated; no Korean mapping. `hold_rights_and_item_scope`. |

The last two are **new source leads**, not file-backed candidates. Neither was copied into the repository or given an admission status. The previous NASA admission count remains one; the other sources above add zero admissions.

## Korean textbook batch

Six prioritized local files were rehashed from `C:\Users\Administrator\Documents\영어\시중교재` and all six SHA-256 values matched inventory indices 13, 14, 16, 19, 24 and 25 in the prior `source-review-r3b.json` (SHA-256 `6a2b345ecd436941220f666f7dfba63fe79ba6cc32909b8847498e7fdc080ba6`). Their publisher pages identify product and target-grade **claims**, including multi-grade ranges. Those claims were not substituted for file-level evidence.

| Index | Local file SHA-256 prefix | [NE Books](https://www.nebooks.co.kr/) product / claimed target | Current result |
| --- | --- | --- | --- |
| 13 | `6e4ec22873dd` | [Reading Inside Level 2](https://www.nebooks.co.kr/pages/book/view.asp?c=BB07000126), middle 2–3 | `hold_metadata` |
| 14 | `4f72e9474699` | [Junior Reading Tutor Level 2](https://www.nebooks.co.kr/pages/book/view.asp?c=BB07000130), middle 1 | `hold_metadata` |
| 16 | `95f81e166fdf` | [Middle-school CSAT Deep Reading 1](https://www.nebooks.co.kr/pages/book/view.asp?c=BB07000140), middle 1–2 | `hold_metadata` |
| 19 | `a18332d1856f` | [Middle-school CSAT Deep Reading 2](https://www.nebooks.co.kr/pages/book/view.asp?c=BB07000139), middle 2–3 | `hold_metadata` |
| 24 | `b884d88700cc` | [Dalgomhan Literacy Reading 2](https://www.nebooks.co.kr/pages/book/view.asp?c=BB07000134), elementary 3–4 | `hold_metadata` |
| 25 | `31a832fa08a0` | [Dalgomhan Literacy Reading 3](https://www.nebooks.co.kr/pages/book/view.asp?c=BB07000135), elementary 3–4 | `hold_metadata` |

The existing evidence ledger marks `rights_verified=false`, `edition_verified=false`, `grade_scope_verified=false` and `boundary_verified=false` for each. This batch confirmed byte identity only; it did **not** infer those four decisions from the filenames or publisher listings. NE Books' [research/sample-book notice](https://m.nebooks.co.kr/pages/customer/notice/?nid=1014) directs inquiries through distributors and is not an analysis license. The [publisher page for Reading Inside Level 2](https://www.nebooks.co.kr/pages/book/view.asp?c=BB07000126) lists its grade, ISBN and downloadable answer material, but does not grant the internal extraction and benchmark use required here. The prior index-14 page/edition mismatch investigation remains documented in [the BC Reads and Korean cohort audit](./bc-reads-admission-and-korean-cohort-20261008.md). None of the six yielded a reviewed passage candidate.

A public-sector Korean alternative was also checked at the rights gate: the [Gyeonggi education office's English assessment-tool listing](https://www.goe.go.kr/goe/na/ntt/selectNttInfo.do?mi=10961&nttSn=2364567) identifies the work as KOGL Type 2 (attribution plus noncommercial restriction). That listing cannot establish rights for this commercial calibration workflow or clear any third-party passage; it was not converted into an eligible passage.

## Common blocker taxonomy and next evidence

| Code | Meaning | Evidence required before retry |
| --- | --- | --- |
| `RIGHTS_SCOPE_UNVERIFIED` | Public availability, purchase or catalog entry does not establish the planned passage/item analysis right. | Passage/item-level license and third-party clearance, or an explicit covered permission record. |
| `EDITION_FILE_UNBOUND` | Catalog title/ISBN or current web edition does not prove the local bytes are that edition. | Local imprint/ISBN/version locator and an official edition record bound to the file hash. |
| `GRADE_ANCHOR_UNVERIFIED` | Source age/reading level or catalog grade is not yet a reviewed file-specific grade scope. | Edition-bound source label; a separate comparative Korean mapping for calibration. Multi-grade ranges stay ranges. |
| `BOUNDARY_KEY_UNBOUND` | Passage, questions and key are not proven to be from the same version and reviewed locator. | Source-page locators, interval hashes and answer-key correspondence. |
| `GROUNDING_HOLD` | A keyed answer overstates or changes the passage evidence. | Explicit item-set editorial decision, new item-set hash and fresh rating against that revision. |
| `RATING_REVISION_PENDING` | No independent admission-grade nine-axis review is bound to the current item/evidence set. | Two independent model-family reviews, disagreement adjudication and a new immutable analysis receipt **after** upstream gates pass. |

These are evidence gaps, not automatic rejection of the works. No selected IDs were added to a new screening or sample manifest, because none met the file-level candidate gate. Reopening a held source requires a new revision; the prior seals cannot be edited in place. A single later admission would prove the intake path, not a representative Korean-grade distribution.

## Result

New `CALIBRATION_REFERENCE eligible N=0`; new Korean eligible passage N=0; existing open-reference admitted N=1 (NASA); Korean benchmark corpus N=0; real Korean-grade nine-axis distribution N=0; `BENCHMARK_TARGET_FIT` and `BENCHMARK_LEVEL_SEPARATION` unopened; Gold-S=0; DB seed=0; `production_verified=false`. This batch did **not** attain its at-least-one eligibility target. The strongest actionable dependency is an explicit analysis-rights record for a local Korean textbook, or an open source with a same-version passage/item/key, clear passage rights and independently supportable Korean grade mapping.
