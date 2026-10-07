# Local textbook benchmark evidence enrichment: screening revision 2

The original 31-file inventory and stage-one selection seal remain unchanged. This revision checks the current local files against the existing platform textbook corpus and binds a new metadata screening to a new empty sample manifest. It does **not** admit a passage or validate a grade level.

| Check | Result |
|---|---|
| Current inventory | 31/31 SHA-256 matches; 30 unique files and one duplicate alias |
| Local corpus crosswalk | 29 inventory rows / 28 unique files match exact path + current SHA-1 + extracted-source hash + DB doc hash; two ZIP files not indexed; zero stale matches |
| Existing corpus role hints | Across 30 unique files: eight book, nine preview, two body, eight answer/explanation, one word list, two not indexed |
| Existing corpus grade hints | Six unique files have single-grade labels, but all are unreviewed heuristic classifications |
| Page hints from indexed extracted text | Across unique files: ISBN marker pages in five, possible English-passage pages in 27, possible item pages in 26; 15 inventory rows have a page-hint list truncated to 20 locators, with the full count recorded separately |
| Confirmed rights, edition, grade and passage/item boundary | Zero files; heuristic hints cannot satisfy these gates |
| Screening revision 2 | 30 unique files held, zero passage candidates |
| Independently recomputed sample manifest | Zero selected; `insufficient_benchmark` |

The page lists are **search locators**. An English-heavy page may be an answer explanation or word list; a question-like marker may be unrelated to a complete item set. The existing corpus labels are useful for finding the correct cover, imprint, passage and question pages but are not publisher attestation, exact-edition evidence, a verified single-grade claim or an analysis license. This run did not inspect and certify those boundaries. The two ZIP files have no byte-matched corpus entry; their central directories were inspected without extraction, but member lists are not bound to this ledger. The archived members are not individually admitted or classified. Original textbook files and raw page text stayed outside Git.

The create-only artifacts are in `D:\workspace\Vocaflow-benchmark-audit-20261008`. The first run's `selection-stage1.json`, `pdf-metadata-probe-v2.json`, `metadata-screening-input-v2.json` and `sealed-benchmark-protocol-v2.json` remain intact. An earlier r1 enrichment draft and intermediate r2 screening/protocol files were superseded after review; the authoritative revision 2 artifacts are:

| Artifact | SHA-256 file digest |
|---|---|
| `evidence-ledger-r2.json` | `58dfc69f16d9fb6fce427ea6da11403a9e6d2d238e4d7535cb97525f13eef7cb` |
| `metadata-screening-input-r2-final2.json` | `95f863374bc591bea4773dd2b5a00c81c4675bdb0d2f47f8431c93621d68122b` |
| `sealed-benchmark-protocol-r2-final2.json` | `e88a63ce2f42ae78dadb0895375fcfe0cbb1b44ca415e3cddba5687125eca92a` |

The stage-one selection protocol hash remains `99c536c36539022d10a3845faae68aeb2f95fcb8fae8f0e9ab8eb3baa1d7c51a`. Revision 2 has `metadata_screening_hash=fdbfae9dbb18129bceb8051338182bb699d8b6f1fdc37ee75d07235f358ead71` and `selection_manifest_hash=f3675116422c3f7a38777bd1250d62a664e58d9bbd50b31b93d66ff0d9a6b4ce`. Read-only verification rehashed the current 31 files, local corpus manifest and corpus database, **recomputed the ledger from those sources**, checked the ledger/screening bond and independently recomputed the selected IDs. It returned zero selected and `insufficient_benchmark`.

The remaining work is source-by-source confirmation of the acquisition/analysis-rights basis, publisher and exact edition/ISBN, single target grade, and visually reviewed passage/question page boundaries. Such confirmations need their own source locators and review record. They must produce a **new screening and manifest revision**; this hint-only revision is not editable in place. Until then, benchmark corpus N=0, real nine-axis distribution=0, Gold-S=0, DB seed=0, and Phase 3 operational E2E remains pending.
