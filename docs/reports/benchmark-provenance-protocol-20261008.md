# Benchmark provenance verification protocol

This protocol governs the next **file-level evidence review**, before a new metadata-screening revision. It does not amend the sealed selection protocol, screening revision 2, or sample manifest. A catalog record is a reference to a possible product, not proof that a local file is that edition or may be analyzed. The four currently probed Level 1/2 files remain `hold`.

## Independent decisions

Each decision records `file_sha256`, `source_path_hash`, `reviewer_id`, `reviewed_at`, an evidence locator and its SHA-256 where a local artifact exists. A claim without a locator is `unverified`; a matching filename or catalog title is only a hint. Keep original files and permission documents outside Git. Store no passage, item, answer, credential, personal contact detail or permission-document body in the metadata ledger.

| Decision | Required evidence | Hold when |
|---|---|---|
| `edition_verified` | Local cover/imprint or publisher-hosted original file identifies title, series, publisher, edition/year and ISBN or stable publisher edition ID; the official catalog identifies the same edition. Record the local locator, official URL, catalog snapshot hash and matching local/catalog identifiers. | Only filename, catalog ISBN or a similar title is available; local and catalog editions conflict. |
| `grade_scope_verified` | Local cover/imprint grade claim and a hashed official catalog snapshot agree under the sealed grade-scope mapping. Preserve the entire range or noncontiguous set; do not coerce it to a single grade. | Either claim is absent or inconsistent. A multi-grade claim alone is not a hold reason. |
| `analysis_rights_verified` | Acquisition/terms or rights-holder permission identifies the covered material and permitted **internal analysis**, including storage/extraction limits and any expiry. Record grantor, scope, evidence locator and review decision. | Public download, preview availability, purchase receipt alone, or generic copyright notice is the only evidence. |
| `boundary_verified` | Reviewer visually identifies one passage and its associated items and answer/key, with source-file hash, printed and PDF page locators, start/end anchor hashes, and OCR review when applicable. Raw anchors stay outside Git. | Page text or `Reading`/`UNIT` markers merely suggest a boundary; questions/key or an endpoint is uncertain. |

The rights disposition is independent of the other three decisions:

- `AUTHORIZED_FOR_ANALYSIS`: documented permission or applicable terms cover the planned internal extraction and measurement. This is a reviewed upstream rights decision, not a conclusion inferred by the importer.
- `CATALOG_REFERENCE_ONLY`: bibliographic facts may be recorded, but the local file cannot enter a measured cohort.
- `UNKNOWN`: no adequate rights decision. Both this and catalog-only map to `analysis_rights_verified=false`.

If a permission is withdrawn or expires, all dependent screening, admission receipts, distributions and decisions become stale or invalidated under the existing rights gate. Rechecking the four booleans against only their old serialized values is insufficient; the underlying evidence must still be current.

## Cohort boundary

`commercial_textbook` and `open_reference` are distinct selection protocols, manifests, distributions and decisions. An open-reference source needs its own license/terms locator, version and permitted analysis scope; accessibility alone does not qualify it. An open-reference distribution can exercise the real measurement path but cannot be reported as the commercial-textbook market distribution or satisfy its publisher/series quotas. Neither cohort can borrow samples to clear the other's minimum. F02's commercial `BENCHMARK_TARGET_FIT` and `BENCHMARK_LEVEL_SEPARATION` remain unopened until the commercial cohort itself qualifies.

## Revision and handoff

1. Rehash the source and compare it with the immutable inventory. Record each decision independently, including conflicting official claims and the reviewed source version. A four-way pass means **file evidence is ready for passage screening**, not automatic admission.
2. For a passing file, create stable passage-level candidate IDs and reviewed passage/item/key boundaries without measuring the nine difficulty axes. Apply the already sealed selection algorithm and independent recomputation to a **new** screening revision and **new** sample manifest. Keep all earlier artifacts create-only.
3. Only selected IDs may proceed to nine-axis review and admission. The resulting receipt binds the current source, evidence revision, codebook and manifest. An evidence edit creates a new revision/hash and makes downstream results stale.

The original `real-intake-screen.mjs` remains the file-level hold path and still throws `ELIGIBLE_FILE_REQUIRES_PASSAGE_SCREENING` if its legacy inventory fields all pass. Reviewed evidence uses the separate `real-intake-screen-reviewed.mjs` path, which creates passage-level metadata candidates in a new revision and requires the same external input again for sealing and verification. Its structural checks cannot authenticate a rights-holder's permission or the reviewer's visual judgment; those remain upstream evidence responsibilities. A selected candidate remains outside the measured/admitted corpus.

## Current evidence

The read-only local audit `D:\workspace\Vocaflow-benchmark-audit-20261008\provenance-audit-r4.json` has SHA-256 `5a45ccd8b899a99e8fbf812ad4826e7413b69dada577825931beb579f2d4f1bc`. Four Level 1/2 preview/answer PDFs match the inventory's file and path hashes. The previews are 19 PDF pages each and the answer files 96 pages each. The recorded structure markers identify pages for review, **not** visually confirmed passage/item boundaries. No ISBN was extracted from these files by this probe. Official NE catalog pages for [Level 1](https://www.nebooks.co.kr/pages/book/view.asp?c=BB07000140) and [Level 2](https://www.nebooks.co.kr/pages/book/view.asp?c=BB07000139) provide possible ISBN and grade claims, but local-edition binding, analysis rights and boundaries remain unverified. The Level 1 target-grade label differs between indexed versions of the publisher page, so its catalog grade claim needs a dated source snapshot. All four stay `hold`; admitted corpus, measured distribution, Gold-S and DB seed stay zero.
