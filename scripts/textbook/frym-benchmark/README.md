# FYM commercial textbook benchmark engine

This directory contains the **metadata-only** benchmark contract, distribution builder, F02 comparator, and stale checks. No commercial passage or item text is stored here. The currently tracked benchmark corpus is **N=0**; no production protocol or textbook sample is sealed. All test records are generated in memory and are synthetic fixtures.

## Input contract

`protocol.json` must have `schema=frym-benchmark/1`, `status=sealed`, a version, SHA-256 hashes of the codebook and selection manifest, and an embedded sealed `selection_manifest` whose `selected_sample_ids` hash matches `selection_manifest_hash`. `codebook_hash` must equal the canonical hash of the embedded `axes`. It must cover `elementary_5`, `elementary_6`, `middle_1`, `middle_2`, `middle_3`, `high_1`, `high_2`, `high_3` in that order. Each of the nine axes declares one primary metric, a `ratio` or `ordinal` scale, unit, measurement method, missing rule, rater policy, and burden direction; ordinal axes also declare ordered anchor levels. The minimum, fit, and separation rules are validated by `validateProtocol`; a draft or altered seal fails closed. **The real codebook and selected IDs must be fixed before textbook difficulty measurements.**

Each metadata-only sample has `sample_id`, publisher, series, title, single grade, edition, publication year, difficulty step, ISBN (or publisher ID and canonical URL), passage ID, page, genre, source method, rights basis, analyzer version and evidence locator, analysis/passage/item/scoring SHA-256 hashes, word and item counts, codebook/selection hashes, and nine numeric measurements. `rights_basis=authorized_local_analysis` records an upstream rights decision; this engine does not grant permission. Missing items, multiple grade labels, unknown rights, unselected IDs, duplicate passages, missing axes and changed hashes are rejected. Rejections remain visible in the snapshot. Source text belongs in the authorized external store.

For a grade to be calibrated, the builder needs at least 30 eligible passages, three publishers, two series per publisher, publisher share at most 40%, series share at most 20%, at least 12 explanatory, 12 argumentative, six narrative passages, and at least six passages in each length bin (`<150`, `150–299`, `>=300` words). It computes `p10`, `p25`, median, `p75`, IQR, `p90` for every axis. If any grade is insufficient, the workflow stays `insufficient_benchmark`.

The F02 comparator requires the current F02 passage hashes, the **common** item and scoring-key hashes, current freeze hash, the same `codebook_hash`, and an `analysis_hash` equal to the canonical hash of the F02 input object without that field. It also requires an E3 batch verified by the existing cross-agent auditor. Its middle-1 and high-1 arms receive independent benchmark fit results. The fit comparison needs 12 genre/length-matched samples from three publishers per arm; all five core axes and seven of nine axes must lie inside reference p10–p90. Separation compares direction and magnitude only within a common genre/length range and leaves out each publisher in turn to check direction stability. It returns `pass`, `fail`, `inconclusive`, or `insufficient_benchmark`. It can mark `gold_s_candidate`; it **never grants Gold-S or DB seed**.

## Commands

```text
node scripts/textbook/frym-benchmark/benchmark-run.mjs build <sealed-protocol.json> <metadata-samples.json> <new-snapshot.json>
node scripts/textbook/frym-benchmark/benchmark-run.mjs verify <sealed-protocol.json> <snapshot.json>
node scripts/textbook/frym-benchmark/benchmark-run.mjs judge <sealed-protocol.json> <snapshot.json> <metadata-samples.json> <f02-input.json> <verified-e3-batch-dir> <new-decision.json>
node scripts/textbook/frym-benchmark/benchmark-run.mjs verify-decision <sealed-protocol.json> <snapshot.json> <f02-input.json> <verified-e3-batch-dir> <decision.json>
```

`build` and `judge` use exclusive-create output: a rerun cannot overwrite the earlier snapshot or decision. Use a new revision path. `verify` and `verify-decision` are read-only and repeatable. `judge` rechecks the active F02 seal and the **actual 28/28 E3 batch directory** with `verifyStage` before accepting an E3 claim. The hashes bind local files and computed decisions; they are not publisher or model-provider attestations. `verify-decision` returns `STALE` and exit 1 if the version, benchmark snapshot, F02 input, or E3 run changes. A changed sample measurement fails comparison against the sealed snapshot.

`workflowState` exposes `draft → sealed → insufficient_benchmark | benchmark_calibrated → fail | inconclusive | gold_s_candidate | stale`. It never returns Gold-S or a seed-eligible state. A benchmark revision starts again at a new sealed protocol; prior decisions are preserved and become stale when checked against that version.

Run the synthetic regression suite with `node --test scripts/textbook/frym-benchmark/benchmark.test.mjs`. It does not read the commercial corpus or write to the database.
