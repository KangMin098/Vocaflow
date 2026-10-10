# BC Reads 2015 grounding audit and Korean comparison cohort gate

This is a read-only follow-up to [the independent rating review](./bc-reads-independent-rating-20261008.md). It does not replace the 2015 file or boundary seals, create an admission receipt, or map Adult Literacy Level 5 to a Korean school grade. The inspection script and source files remain outside Git in `C:\Users\Administrator\Documents\영어\공개참조\bc-reads-screen-20261008`.

## Text and item grounding

The archived Reader PDF's page 9 and Course Pack PDF's pages 14 and 23 were directly re-extracted with `pdfjs-dist@6.3.289`. The question wording and answer-key entries below occur in those PDF bytes, not only in the HTML-structured rating packet. The corresponding PDF file and interval hashes remain those recorded in [the file evidence report](./bc-reads-file-evidence-20261008.md).

| Check | 2015 PDF observation | Decision |
|---|---|---|
| Question 3e | The item compares whether computers are “smarter” than mice; the Reader compares supercomputer *power* with half a mouse brain. The key marks 3e false. | `SOURCE_ITEM_SEMANTIC_MISMATCH`: the key is present, but “smarter” is not directly established by the cited power comparison. Requires editorial grounding review. |
| Question 4c | The item asks “as fast as” a brain; the Reader's mouse comparison says “as powerful as.” A later sentence makes a separate claim about human-brain speed. The key supplies `mouse`. | `SOURCE_ITEM_SEMANTIC_MISMATCH`: mouse is recoverable from a changed predicate, but the cited comparison does not assert mouse-brain speed. Requires editorial grounding review. |
| Answer key | Both 3e and 4c have entries in the same archived Course Pack chapter key. | Boundary/key association confirmed; a present key does not cure semantic mismatch. |
| HTML text | Archived HTML recovers paragraph/list structure but loses some punctuation and flattens the teaching table. | `EXTRACTION_FIDELITY_HOLD`: full PDF↔HTML text equivalence remains unverified; do not substitute the HTML packet for a canonical PDF analysis without a reviewed transcript. |

The anomalies are **present in the 2015 source**, so treating them solely as OCR defects or assuming the current publisher version fixes them would be unsupported. This audit did not revise the questions, override the source key, or fact-check the Reader's scientific assertions. The existing nine-axis vector remains `pre-admission provisional evidence`. A reviewed, exact-file transcript and item-level grounding decision are needed before an admission-grade rating receipt.

## Korean comparison cohort

The sealed local textbook inventory remains 31 file entries / 30 unique files. Its last screening and manifest selected **zero** passages: rights, exact edition, grade scope, and passage/item boundaries were not jointly verified. Six single-grade labels in the platform corpus were only heuristic hints. The official Korean textbook catalog examples in [the source review](./benchmark-source-review-20261008.md) describe product grade ranges but do not bind a local passage, item set, and analysis rights to an exact edition. No Korean comparison passage was promoted by this audit.

An admissible mapping comparison needs a separately sealed Korean selection protocol and sample manifest, exact-edition and rights evidence, passage/item/key boundaries, independent nine-axis analysis, and a cohort large enough for a grade distribution. A single catalog grade label, or the Canadian adult-literacy description alone, cannot yield a relative Korean grade band. The existing empty manifest must remain immutable; any new verified candidate requires a new screening revision and manifest hash.

## State

`BC Reads text/item review=source mismatch confirmed, editorial hold`; `PDF↔HTML transcript fidelity=hold`; `admission-grade rating=pending`; `Korean comparison cohort N=0`; `Korean-grade mapping=pending`; `calibration-eligible N=0`; real Korean-grade distribution N=0; Gold-S=0; DB seed=0; `production_verified=false`.
