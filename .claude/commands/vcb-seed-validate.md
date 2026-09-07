---
description: VCB Step 1 safety net — validate an AI-generated seed list against user-prepared reference files (Anki CSV, NGSL, domain glossaries) and the spec's purpose/level/segment. Fans out vcb-seed-validator subagents per chunk and aggregates a coverage report that names missing must-cover lemmas, polluting lemmas, level outliers.
argument-hint: <seed-list-path> [--spec <spec-file>] [--refs <dir-or-comma-paths>] [--chunk-size N] [--wave-size 3] [--output-dir <path>] [--force]
allowed-tools: Read, Write, Bash, Glob, Agent
---

You are the orchestrator for VCB Step 1 seed-list validation. The curator has
generated an AI seed list via `/vcb-seed-list` and prepared reference files
(Anki decks, NGSL frequency lists, domain glossaries). Your job is to spawn
parallel `vcb-seed-validator` subagents that judge each lemma against the
spec + references, then aggregate the global coverage report (including
must-cover gaps the curator must fix).

This complements the existing schema validator `01c-validate-seed-list.mjs`
(which checks POS/CEFR/tier values). This slash adds **semantic** validation.

## Arguments

`$ARGUMENTS` is the full argument string. Parse:

- **Positional (required)**: `<seed-list-path>` — path to the seed JSONL
  (e.g. `exports/vcb-jobs/20260515-0737-cast-2000-seed-list.jsonl`).
- `--spec <path>` — path to the seed spec JSON. Default: derive from seed
  filename (replace `-seed-list.jsonl` → `-seed-spec.json`). Required to
  exist — stop if missing.
- `--refs <path>` — Path to either a directory containing reference files
  OR a comma-separated list of file paths. Default search order:
  1. `data/seed-references/<slug>/`
  2. `data/curation-references/<slug>/` (reused — same shape as Step 7)
  3. Stop if neither exists and `--refs` not given.
- `--chunk-size N` — split the seed into N-lemma chunks (default: 500).
  Use 0 to process the entire seed in one subagent.
- `--wave-size N` — process chunks in waves of N (default 3).
  0 fans out everything at once.
- `--output-dir <path>` — where reports go. Default:
  `exports/vcb-jobs/<slug>-seed-validation-<YYYYMMDD>/`
- `--force` — re-run even if output files exist.

If `<seed-list-path>` not given: stop with usage.

## Step 1 — Validate inputs

- Seed file exists and parses as JSONL (count lines)
- Spec file exists and parses as JSON (extract `target_count`,
  `target_cefr_range`, `target_segment`, `domain_hints`,
  `must_include_keywords`, `must_exclude_keywords`)
- Every reference file exists and has expected extension
  (`.csv`, `.tsv`, `.json`, `.jsonl`, `.txt`)
- For CSV/TSV: header line has at least a `word` column
- For `.json/.jsonl`: spot-check first entry has `word` field
- Load `reference-meta.json` if present in references directory (recommended)

Reference format guide: `scripts/vcb/data/reference-formats.md`. If any
reference fails validation, STOP with a specific actionable error.

## Step 2 — Chunk plan

```bash
wc -l <seed-list-path>
```

Compute chunks:
- If `--chunk-size 0` OR seed has ≤ chunk-size lines: 1 chunk ("all")
- Otherwise: split into chunk-size-line pieces (write temp chunks to
  `<output-dir>/_chunks/seed-chunk-NN.jsonl`)

For typical cast-2000 (2000 lemmas) with default chunk-size 500: 4 chunks.

Print plan:

```
seed:           <path>  (<N> lemmas)
spec:           <path>  (target_count=<N>, segment=<seg>, cefr=<band>)
references:     <count> files (<list with roles>)
chunks:         <N>  (size <N>)
mode:           wave (size=N) | all-at-once
output_dir:     <path>
```

## Step 3 — Prepare output directory

```bash
mkdir -p <output-dir>
mkdir -p <output-dir>/_chunks   # if chunking
```

Write `summary.json` placeholder so partial completion is inspectable:

```json
{
  "seed": "...",
  "spec": "...",
  "started_at": "<ISO>",
  "references": [...],
  "chunks_planned": <N>,
  "chunks_completed": [],
  "status": "in_progress"
}
```

## Step 4 — Fan out via Agent tool

**Claim first.** The workspace is shared by concurrent sessions and file-based drains
have no `SKIP LOCKED` equivalent (measured 2026-08-26 on the `pending_words` fan-out:
two subagents found another session's output already written into their chunk). Do not
hand-roll this — use the shared tool that all four fan-out commands share:

```bash
node scripts/lib/claim-chunks.mjs --dir <output-dir>/_chunks \
     --in 'seed-chunk-*.jsonl' --done 'seed-chunk:chunk' \
     --done '.jsonl:.seed-validation.md' --done-dir <output-dir> \
     --max <wave-size> [--force]
```

Spawn **only** what prints as `CLAIM`. Claims older than 30 minutes are reclaimed
automatically (`STALE`). Release at the end of the wave, **including failed chunks**
(a stale claim blocks that chunk for 30 minutes):
`node scripts/lib/claim-chunks.mjs --release <chunk paths>`

For each claimed chunk, spawn a `vcb-seed-validator`
subagent in a SINGLE message with multiple Agent tool calls:

```
Agent(
  description: "Validate seed chunk NN",
  subagent_type: "vcb-seed-validator",
  prompt: <see template>,
  run_in_background: true,
)
```

### Per-agent prompt template

```
You are validating chunk {NN | "all"} of an AI-generated VCB seed list.

Seed chunk:        {ABSOLUTE_PATH}
Spec file:         {ABSOLUTE_PATH}
Reference files:   {COMMA-SEPARATED_ABSOLUTE_PATHS}
Reference meta:    {ABSOLUTE_PATH or "none"}
Output prefix:     {output-dir}/chunk-{NN}

Follow your role instructions (.claude/agents/vcb-seed-validator.md). The
reference format guide is at scripts/vcb/data/reference-formats.md.

When done, report back with the exact format in your role.
```

## Step 5 — Aggregate (orchestrator only — agents don't do this)

After all chunks complete, compute the **global checks** that no per-chunk
agent could compute alone:

### A. must_cover_misses (coverage gaps)

For each reference file with role `must-cover` (per reference-meta.json):
1. Load ref words into a set
2. Load all seed lemmas into a set
3. Compute `missing = ref_words - seed_words` (set difference)
4. These are lemmas the curator MUST add to the seed (or remove from the
   must-cover ref if they're truly out of scope)

```bash
node -e "
const fs = require('fs');
const path = require('path');
const seed = new Set(
  fs.readFileSync('<seed-path>', 'utf8')
    .split('\n').filter(Boolean)
    .map(l => JSON.parse(l).lemma.toLowerCase())
);
const ref = fs.readFileSync('<must-cover-ref>', 'utf8').split('\n').slice(1) // skip header
  .map(l => l.split(',')[0].trim().toLowerCase()).filter(Boolean);
const missing = ref.filter(w => !seed.has(w));
console.log(JSON.stringify(missing, null, 2));
"
```

(Adjust for TSV/JSON/JSONL/plain-txt formats as needed — use the same
parsing logic the per-chunk agents used.)

### B. duplicate_lemmas

Check for case-insensitive duplicates within the seed itself.

### C. distribution_check

- Total lemma count vs `spec.target_count` (±10% acceptable per spec)
- CEFR distribution per `target_cefr_range`
- POS distribution sanity (no all-nouns, no zero-verbs)

### D. spec_keyword_completeness

- `must_include_keywords` in seed? (any missing = curator must add)
- `must_exclude_keywords` NOT in seed? (any present = removed by validator)

Write `coverage-report.json` and `coverage-report.md` with these globals.

## Step 6 — Final aggregated summary

Update `summary.json` to `status: 'complete'` with totals:

```json
{
  "seed": "...",
  "spec": "...",
  "completed_at": "<ISO>",
  "status": "complete",
  "totals": { "keep": 1654, "review": 287, "remove": 59 },
  "coverage": {
    "target_count": 2000,
    "actual_count": 2000,
    "delta_pct": 0,
    "must_cover_misses": { "anki-toeic-700.csv": 23, "anki-suneung.csv": 8 },
    "duplicate_lemmas": 0,
    "spec_must_include_missing": 0,
    "spec_must_exclude_present": 0
  },
  "cefr_distribution": { "A1": 240, "A2": 410, ... },
  "by_chunk": [...]
}
```

Write `<output-dir>/summary.md` (human overview):

```markdown
# VCB Seed Validation — <slug>

**Spec:** target_count=2000, segment=toeic, cefr=[A2,B2]
**Seed:** 2000 lemmas (Δ 0% vs target)
**References:** 4 files

| Verdict | Count | % |
|---|---|---|
| keep    | 1654 | 82.7% |
| review  | 287  | 14.3% |
| remove  | 59   | 3.0%  |

## Coverage gaps (must-cover misses)

The following words are in `must-cover` references but NOT in the seed.
The curator should either (a) add them to the seed and re-run, or
(b) remove them from the must-cover ref (out of scope).

### anki-toeic-700.csv (23 missing)
- compliance
- diversification
- ...

### anki-suneung-vocab.csv (8 missing)
- ...

## Spec keyword status
- `must_include_keywords`: ✓ all present
- `must_exclude_keywords`: ✓ none in seed

## Distribution check
- CEFR: A2=410, B1=820, B2=620, (others=150) — within target band
- POS: NOUN=1102, VERB=420, ADJ=312, ADV=104, others=62 — healthy mix

## Per-chunk reports
- chunk-01.seed-validation.md (lemmas 1-500)
- chunk-02.seed-validation.md (lemmas 501-1000)
- chunk-03.seed-validation.md (lemmas 1001-1500)
- chunk-04.seed-validation.md (lemmas 1501-2000)

## Curator workflow

1. Open `coverage-report.md` — review the must-cover misses first.
   Add missing lemmas to the seed (manually edit JSONL) OR re-run
   `/vcb-seed-list` with updated `must_include_keywords`.
2. Open `chunk-NN.seed-validation.md` — review `remove` verdicts in each
   chunk. Decide whether to drop those lemmas.
3. Scan `review` verdicts (sorted by `verdict_confidence` ascending).
4. Iterate: edit seed → re-run `/vcb-seed-validate` until clean.
5. Proceed to Step 2: `pnpm vcb:normalize`.
```

## Step 7 — Final response

Print to your final output:

```
========== VCB Seed Validation Report ==========
seed:             <path>  <N> lemmas
spec:             <path>  segment=<seg>  count target=<N>
references:       <N> files
output_dir:       <absolute>

verdict totals:   keep=<N> (XX%)  review=<N> (XX%)  remove=<N> (XX%)
coverage gaps:    <total must-cover misses across all refs>
duplicates:       <N>
spec compliance:  <pass | fail>  (must_include / must_exclude)

Open these next:
  - <output-dir>/summary.md           (overview + gaps)
  - <output-dir>/coverage-report.md   (must-cover misses to add)
  - <output-dir>/chunk-NN.seed-validation.md

Next step:
  - Edit seed list to address gaps
  - Re-run /vcb-seed-validate to confirm clean
  - Then pnpm vcb:normalize  (Step 2)
================================================
```

## Convenience defaults

- Default subagent model: Opus (from agent frontmatter)
- Default chunk-size: 500 (small enough for good attention, large enough
  to amortize agent startup)
- Default wave-size: 3
- Default output: `exports/vcb-jobs/<slug>-seed-validation-<date>/`
- Idempotent: existing reports skipped unless `--force`

## Anti-patterns

- Do not modify the seed JSONL — read-only across the whole flow
- Do not call the schema validator (`01c-validate-seed-list.mjs`) — that's
  separate and runs from `/vcb-seed-list` automatically. This slash is for
  semantic validation only.
- Do not regenerate any lemmas — `/vcb-seed-list` does that
- Do not Bash-call this slash from inside itself
- Do not skip the global must_cover_misses computation — it's the most
  valuable output of this flow

## Example invocations

```
/vcb-seed-validate exports/vcb-jobs/20260515-0737-cast-2000-seed-list.jsonl
  → auto-discovers spec + refs, default chunk 500, wave 3

/vcb-seed-validate <seed.jsonl> --refs data/refs/anki.csv,data/refs/ngsl.csv
  → explicit refs

/vcb-seed-validate <seed.jsonl> --chunk-size 0
  → process all lemmas in a single subagent (smaller seed lists)

/vcb-seed-validate <seed.jsonl> --force
  → re-run all chunks
```
