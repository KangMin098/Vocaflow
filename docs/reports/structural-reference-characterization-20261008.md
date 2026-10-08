# Structural reference characterization (2026-10-08)

The two eligible references from [the role screen](./open-reference-role-screen-20261008.md) were reread from their external HTML snapshots. Source and rights hashes were rechecked. An operator-selected HTML interval for each source was then bound by its exact excerpt SHA-256 before deterministic, **non-grade** counts were calculated. The range for FYM starts at the “Choice and Rationality” heading and ends before “Glossary”; the African Storybook range starts at the first story-text block and ends before the “Questions” block. This is a structure sketch, not a complete-page linguistic assessment or a nine-axis rating.

External-only inputs/outputs under `C:\Users\Administrator\Documents\영어\공개참조\open-reference-screen-20261008`:

- `structural-spec-r2.json` SHA-256 `819d0a8914fe6d08b1f35b0cf3c51b59170210a2e1a1642b33a25ccf4047745f`
- `structural-corpus-r3.json` SHA-256 `10efa306574d7bcf88d09a06fc0cbd1e0433d4a5a483cb51f6af90bb3c24ef81`; corpus hash `a12a3caf66fbf449fe5e26a5bc70453964180a4ef8153a39002c652761005727`

| Source | Words in selected HTML interval | Sentence-like spans | Median words/span | Text blocks | Headings | List items |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| FYM rational-choice article | 1,433 | 82 | 17 | 14 | 3 | 2 |
| African Storybook tennis story | 511 | 41 | 13 | 2 | 0 | 0 |

These counts are deterministic descriptions of the selected HTML intervals. They have no Korean grade interpretation; the intervals can contain captions or layout text, and the script's punctuation split is not a linguistic parser. The storybook question block is outside the analyzed interval, so its zero list-item count does not mean the source lacks questions. The source text and linked illustrations were not copied into Git.

`bindStructuralPlanningNote` can attach profile hashes to a Product Order ID/revision/hash as a **caller-supplied, advisory-only sidecar** for passage structure, sentence shape, discourse cues, and item-format planning. It never changes an order's target, difficulty profile, or evidence revision, and the caller-supplied order hash is not authenticated here. Production and benchmark gates do not read this sidecar. Open-reference benchmark entry still requires a verified admission and calibration decision; `TARGET_FIT`, `LEVEL_SEPARATION`, Gold-S, and DB seed remain closed.

Status: structural profiles N=2, calibration-eligible N=0, actual grade distribution N=0. NASA/EIA structural holds and NASA's existing admitted N=1 remain unchanged. The earlier failed/incomplete `structural-spec-r1.json` and `structural-corpus-r2.json` are exploratory artifacts, not inputs to this result.
