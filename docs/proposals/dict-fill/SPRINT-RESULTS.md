# Dict-fill Sprint — Completion Report (2026-05-17)

Executed in a single session against `shared_dictionary` on the `vocaflow-dev` Supabase project.

## Phase results

| Phase | Words target | Chunks | OK rate | Updated to DB | Cost (Opus 4.7) |
|---|---:|---:|---:|---:|---:|
| **P1** Top 1K NGSL untouched | 617 | 13 | 100% (617/617) | 617 | ~$31 |
| **P2** Top 1K~5K NGSL untouched | 2,221 | 45 | 100% (2,221/2,221) | 2,221 (1,721 new + 500 wave 1-2 already applied) | ~$111 |
| **Total** | **2,838** | **58** | **100%** | **2,338 new + 500 prior = 2,838** | **~$142** |

Zero failures. Two minor self-corrections inside chunks (one IPA missing closing `/`, one chunk needing irregular-verb base form) were caught by the local validator and re-issued within the same agent.

## shared_dictionary fillrate post-sprint (22,762 rows total)

| Frequency bucket | total | has_example_en | % |
|---|---:|---:|---:|
| rank ≤ 1000 (Top 1K) | 1,015 | 1,015 | **100.0%** |
| 1000 < rank ≤ 5000 | 3,011 | 3,011 | **100.0%** |
| rank > 5000 | 8,156 | 51 | 0.6% |
| rank NULL (non-NGSL) | 10,580 | 269 | 2.5% |

Per-column fillrate (Top 5K = 4,026 rows):

| Column | Filled | % |
|---|---:|---:|
| example_en | 4,026 | 100.0% |
| ipa | 4,026 | 100.0% |
| collocations | 4,025 | 99.97% |
| synonyms | 3,904 | 97.0% |
| antonyms | 2,198 | 54.6% |

All P1/P2 exit thresholds (per MASTER.md) cleared.

## Deviations from plan

- **API plan limit hit mid-P2** after wave 2 (chunks 06-10). Auto-recovered after reset ~1.5h later. The probe (chunk 11) confirmed reset, then waves 3-9 ran without further interruption.
- **R3 IRREGULAR map gap**: chunk 11 surfaced "strike → struck" not in the validator's irregular set. Agent self-corrected by switching to base/`-ing` form. Adding "strike → struck" to `packages/wlp/src/qa/rules.ts` IRREGULAR_FORMS is a small follow-up.

## Out of scope (intentional)

- **Top 5K+ (8,156 rows)** and **rank NULL (10,580 rows)** — deferred. Lazy enrich at first use or a separate sprint.
- **POS-mismatched VCB lemmas (492 rows)** — deferred to a polysemy / multi-pos policy task.
- **Korean-centric columns** (`ncic_grade`, `csat_data`, `konglish_data`, etc.) — separate option K plan.

## Process artifacts

Input/output JSONL and validation reports for all 58 chunks live in `exports/dict-fill/` (now gitignored — regenerable from `01-export-job.ts` + a re-run of the slash command).
