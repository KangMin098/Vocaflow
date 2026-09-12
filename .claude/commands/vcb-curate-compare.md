---
description: VCB Step 7 helper — compare enriched entries against user-prepared reference files (Anki CSV, NGSL, domain lists) and produce per-word verdicts for the curator. Fans out vcb-curation-comparator subagents in parallel.
argument-hint: <job-slug> [--refs <dir-or-comma-paths>] [--chunks 01,02,...] [--wave-size 3] [--output-dir <path>] [--force]
allowed-tools: Read, Write, Bash, Glob, Agent
---

You are the orchestrator for VCB Step 7 reference comparison. The curator has
prepared one or more reference files (Anki CSVs, NGSL frequency lists, domain
glossaries, etc.) and wants a second opinion on enriched entries before the
human curation pass.

## Arguments

`$ARGUMENTS` is the full argument string. Parse it as:

- **Positional (required)**: `<job-slug>` — e.g. `20260515-0737-cast-2000`.
- `--refs <path>` — Path to either a **directory** containing reference files
  OR a **comma-separated list** of individual file paths. Default search order:
  1. `data/curation-references/<job-slug>/` (if exists)
  2. `data/curation-references/` (less specific, but accepted)
  3. Error if neither exists and `--refs` not given.
- `--chunks 01,02,...` — restrict to specific chunk numbers. Default: all
  chunks that have a matching `{slug}-enriched-NNofMM.jsonl` file.
- `--wave-size N` — process chunks in waves of N (default **3**). `--wave-size 0`
  fans out everything at once.
- `--output-dir <path>` — where comparison reports go. Default:
  `exports/vcb-jobs/<job-slug>-curation-compare-<YYYYMMDD>/`
- `--force` — re-run comparison even if output files already exist.

If no `<job-slug>`, stop and print expected usage.

## Step 1 — Validate references

```bash
# Discover or validate references
ls data/curation-references/<job-slug>/ 2>/dev/null
```

For each reference path:
- Verify file exists and is readable
- Verify extension is one of: `.csv`, `.tsv`, `.json`, `.jsonl`, `.txt`
- For CSV/TSV: read header line and confirm `word` column is present
- For JSON/JSONL: spot-check first entry has `word` field
- For `.txt`: ensure non-empty

If `reference-meta.json` exists in the references directory, load it and log
the declared purpose + role of each reference. Pass its path to every subagent.

If any reference fails validation, STOP with a specific error pointing at the
file. Do not silently exclude bad references. Suggest the user fix the file
and re-run, or remove it from the references directory.

Reference format guide: `scripts/vcb/data/reference-formats.md`.

## Step 2 — Discover chunks

```bash
ls exports/vcb-jobs/ | grep -E "^<JOB_SLUG>-enriched(-[0-9]+of[0-9]+)?\.jsonl$"
```

Build the **work list** by claiming chunks with the shared tool — do NOT hand-roll
this. The workspace is shared by concurrent sessions and file-based drains have no
`SKIP LOCKED` equivalent (measured 2026-08-26 on the `pending_words` fan-out: two
subagents found another session's output already written into their chunk):

```bash
node scripts/lib/claim-chunks.mjs --dir exports/vcb-jobs \
     --in "${JOB_SLUG}-enriched*.jsonl" --done "${JOB_SLUG}-enriched:chunk" \
     --done '.jsonl:.compare.jsonl' --done-dir <output-dir> \
     --max <wave-size> [--force]
```

Spawn **only** what prints as `CLAIM`. `SKIP … 남이-잡음` = another session is on it;
`SKIP … 이미-완료` = the comparison output already exists. Claims older than 30
minutes are reclaimed automatically (`STALE`).

Release when the wave ends, **including failed chunks**:
`node scripts/lib/claim-chunks.mjs --release <chunk paths>`

Print the discovery summary:

```
job:              <slug>
references:       <N> files (<list>)
output_dir:       <path>
discovered:       <total> enriched chunks
  to compare:     <N>
  skipped:        <K> (comparison already exists)
mode:             pilot? wave (size=N) all-at-once
```

If nothing to do, stop.

## Step 3 — Prepare output directory

```bash
mkdir -p <output-dir>
```

Write a `summary.json` placeholder with run metadata so partial completion is
inspectable:

```json
{
  "job_slug": "...",
  "started_at": "<ISO timestamp>",
  "references": [...],
  "chunks_planned": [...],
  "chunks_completed": [],
  "status": "in_progress"
}
```

Update this file as chunks finish.

## Step 4 — Fan out via Agent tool

For each chunk in the (possibly waved) work list, spawn a
`vcb-curation-comparator` subagent in a SINGLE message with multiple Agent
tool calls:

```
Agent(
  description: "Compare chunk NNofMM vs N refs",
  subagent_type: "vcb-curation-comparator",
  prompt: <see template below>,
  run_in_background: true,
)
```

### Per-agent prompt template

```
You are comparing chunk {NNofMM} of the VCB enrichment against curator reference files.

Enriched file:    {ABSOLUTE_PATH_TO_ENRICHED_JSONL}
Reference files:  {COMMA-SEPARATED_ABSOLUTE_PATHS}
Reference meta:   {ABSOLUTE_PATH_TO_reference-meta.json}  (or "none" if absent)
Output prefix:    {OUTPUT_DIR}/chunk-{NNofMM}

Follow your role instructions (.claude/agents/vcb-curation-comparator.md). The
reference format guide is at scripts/vcb/data/reference-formats.md.

When done, report back with the exact format specified in your role.
```

### Wave handling

- One wave = one orchestrator message with multiple Agent tool calls
- All agents in a wave run concurrently (`run_in_background: true`)
- Wait for all to complete (you'll receive notifications)
- Then send the next wave
- `--wave-size 0` → one wave with all chunks

## Step 5 — Aggregate

When all chunks complete, build a top-level summary:

```bash
node -e "
const fs = require('fs');
const path = require('path');
const dir = '<output-dir>';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.compare.jsonl'));
const totals = { approve: 0, review: 0, reject: 0, total: 0 };
const byChunk = [];
for (const f of files) {
  const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean);
  const c = { chunk: f, approve: 0, review: 0, reject: 0 };
  for (const l of lines) {
    const v = JSON.parse(l).verdict;
    c[v] = (c[v] || 0) + 1;
    totals[v] = (totals[v] || 0) + 1;
    totals.total += 1;
  }
  byChunk.push(c);
}
console.log(JSON.stringify({ totals, byChunk }, null, 2));
"
```

Update `<output-dir>/summary.json` with final totals and `status: 'complete'`.

Write a top-level `<output-dir>/summary.md` aggregating all chunk summaries:

```markdown
# VCB Curation Comparison — <job-slug>

**Generated:** <ISO timestamp>
**References:** <N> files (with roles from reference-meta.json)
**Total entries compared:** <N>

| Verdict | Count | % |
|---|---|---|
| approve | 1654 | 82.7% |
| review  | 287  | 14.3% |
| reject  | 59   | 3.0%  |

## By Chunk

| Chunk | Approve | Review | Reject |
|---|---|---|---|
| 01of10 | 168 | 25 | 7 |
| 02of10 | 175 | 21 | 4 |
| ... |

## Top concerns (rejects)

[List up to 50 most-rejected entries with one-line rationale]

## Needs curator attention (reviews, sorted by uncertainty)

[List up to 100 review entries, sorted by lowest verdict_confidence]

## Next steps

1. Open `chunk-NNofMM.compare.md` for full per-word detail
2. Open `chunk-NNofMM.compare.jsonl` for machine-readable verdicts
3. Curator workflow: handle `reject` first, then `review`, batch-approve `approve`
4. (Phase 2) Import comparison verdicts into curation UI:
   pnpm vcb:import-comparisons -- --run-id <N> --dir <output-dir>
```

## Step 6 — Final user-facing report

Print to your final response:

```
========== VCB Curation Comparison Report ==========
job:              <slug>
output_dir:       <absolute path>
references used:  <N> files
total entries:    <N>
approve:          <N> (XX%)
review:           <N> (XX%)
reject:           <N> (XX%)

Open these to start curation:
  - <output-dir>/summary.md           (overview)
  - <output-dir>/chunk-NN.compare.md  (per-chunk human-readable)

Curator workflow:
  1. Start with rejects (small, prioritized)
  2. Then reviews (sorted by verdict_confidence ascending)
  3. Spot-check 5-10% of approves
====================================================
```

## Convenience defaults

- Default subagent model: Opus (from `vcb-curation-comparator.md` frontmatter)
- Default wave-size: **3**
- Default output dir: `exports/vcb-jobs/<slug>-curation-compare-<date>/`
- Default behavior: idempotent (existing comparison files skipped)

## Anti-patterns (do not do these)

- Do not import verdicts to DB from this slash — curator UI does that
  separately. Phase 2 will add `pnpm vcb:import-comparisons`.
- Do not modify enriched JSONLs based on the comparison — comparison is
  advisory; the curator decides what to fix.
- Do not call the Agent tool one-chunk-per-message — always batch into a single
  message per wave to get concurrent execution.
- Do not skip the reference-meta.json — if it exists, pass its path to every
  subagent. Without it the comparator can't apply role-based logic.

## Example invocations

```
/vcb-curate-compare 20260515-0737-cast-2000
  → uses data/curation-references/20260515-0737-cast-2000/, all chunks, wave 3

/vcb-curate-compare 20260515-0737-cast-2000 --refs data/refs/anki.csv,data/refs/ngsl.csv
  → explicit reference list

/vcb-curate-compare 20260515-0737-cast-2000 --chunks 01 --wave-size 0
  → single chunk pilot

/vcb-curate-compare 20260515-0737-cast-2000 --force
  → re-run all chunks even if comparison output already exists
```
