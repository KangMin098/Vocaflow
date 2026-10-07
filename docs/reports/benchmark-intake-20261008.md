# Local textbook benchmark intake: first sealed run

This run applies the two-stage selection contract to the existing local textbook inventory. It is an **insufficient benchmark**, not an admitted corpus or a grade-validity result. The original files remained outside the repository and were read without modification.

| Gate | Result |
|---|---|
| Inventory integrity | 31/31 file hashes matched the earlier inventory; 30 unique file hashes, one duplicate alias |
| Stage 1 selection rule seal | Completed before PDF metadata probing; run `local-2026-10-08-34245b89e46aae01` |
| Metadata probe | 27 PDF files: 24 yielded front-page text, three require OCR; two ZIP and two HWP files were not parsed by the PDF probe |
| Metadata screening | 30 unique files held; no confirmed passage-level candidate |
| Stage 2 sample manifest | Sealed with zero selected IDs; `insufficient_benchmark` |
| Nine-axis analysis / admission / distribution | Unopened / 0 / 0 |
| Gold-S / DB seed | 0 / 0 |

The first seal fixes the 31-file **local-only** inventory, the 30 unique file hashes, grade quotas, hash ranking, publisher and series caps, genre and length quotas, item types, and the nine-axis ordinal codebook. `search_sources=[]` accurately records that this run did not build a new web-search sampling frame. The stage-one artifact contains a SHA-256 seed commitment; its seed was kept separately until screening finished. A new inventory or changed rule requires a new run.

Because there were no eligible passage candidates, the ranking seed did not affect a selection in this run. The seed separation is a procedure for a future populated screening, not evidence of independent blind selection here. Local timestamps and hashes provide a reproducible execution record, not a third-party timestamp or publisher attestation.

The PDF probe inspected at most the first four pages of each PDF and stored only metadata hints outside the repository. Its OCR and font warnings, possible false ISBN matches, and partial-page scope prevent a publisher, edition, grade, passage, question, or rights claim. The inventory had no rights, grade, edition, passage-boundary, or item-boundary evidence on any of its 31 rows. Therefore all 30 unique files were held for `HOLD_RIGHTS`, `HOLD_GRADE`, `HOLD_EDITION`, and `HOLD_BOUNDARY`; three also have `HOLD_OCR`, and three unique non-PDF files have `HOLD_FORMAT`. No filename or PDF hint was promoted to a candidate ID. An empty manifest is the reproducible result of this screening, not proof that the books lack usable passages.

The metadata-only run artifacts are stored outside Git in `D:\workspace\Vocaflow-benchmark-audit-20261008`. The first probe/screening/final artifacts were superseded after an audit-binding fix; the create-only v2 artifacts below are authoritative. Their SHA-256 file digests are:

| Artifact | SHA-256 |
|---|---|
| `selection-stage1.json` | `0f41b1cd6ebcbe3aaece5e340fcc99c3610f296cc2334438ee2cb9db3d0f30b9` |
| `pdf-metadata-probe-v2.json` | `b9bce594c20042ebfd2fef0138269e464ca3d2c14d5353f267048bc268f9d1df` |
| `metadata-screening-input-v2.json` | `f5646ea48516bd5e06b017b367aeecbe2789272f31edecf2a5fcd8ee1f96707b` |
| `sealed-benchmark-protocol-v2.json` | `56fdd881886a5db1e4c5168f9f478d1dbd41e81e2fcfa03688322a107f660d07` |

The stage-one artifact was created at 2026-10-07 23:13:38 UTC; the replacement probe at 23:19:12, screening at 23:19:13, and final protocol at 23:19:19. Local timestamps establish this run's ordering but are not independent publisher attestation. The contract hashes are `selection_protocol_hash=99c536c36539022d10a3845faae68aeb2f95fcb8fae8f0e9ab8eb3baa1d7c51a`, `metadata_screening_hash=df25d27143bb56f45fa99b71c7abcaf8863960d0f9db83ab2a51915db985bfed`, and `selection_manifest_hash=5dc48bdfea303bc2d8338fd6ab371d69ce0828c09885172aef5dbb0c8bc87694`. A read-only verification rehashed all 31 current source files and validated the full v2 protocol.

To proceed, a new screening revision needs verified acquisition/analysis rights, publisher and exact edition/ISBN, a single grade, and inspected passage/question boundaries for each candidate. The current empty manifest cannot be populated in place. Nine-axis measurement, benchmark distribution, F02 comparison, Gold-S, and seed gates remain closed until an evidence-supported revision passes admission.
