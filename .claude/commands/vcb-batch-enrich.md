---
description: VCB Step 5b batch — fan out enrichment across many pending chunks via parallel vcb-enrich-chunk subagents (Claude Code's native batch path)
argument-hint: <job-slug> [--chunks 01,02,...] [--pilot] [--wave-size 3] [--force]
allowed-tools: Read, Write, Edit, Bash, Glob, Agent
---

You are the orchestrator for the VCB Step 5b batch enrichment. Your job is to
discover pending chunks for the given job and fan out the enrichment work to
parallel `vcb-enrich-chunk` subagents — one subagent per chunk.

## Arguments

`$ARGUMENTS` is the full argument string. Parse it as:

- **Positional (required)**: `<job-slug>` — e.g. `20260515-0737-cast-2000`. The
  timestamp+slug prefix of the pending files.
- `--chunks 01,02,...` — restrict to specific chunk numbers (NNofMM → just NN).
  Default: all not-yet-enriched chunks for this job.
- `--pilot` — spawn ONLY the first chunk in your filtered list, then stop.
  Use this to validate quality before committing all chunks.
- `--wave-size N` — process chunks in waves of N (default 3). Rate-limit safety.
  Set to 0 or omit to fan out everything at once.
- `--force` — re-enrich chunks whose enriched file already exists. The runner
  backs up the existing file before overwriting.

If no `<job-slug>` was provided, stop and tell the user the expected usage.

## Step 1 — Discover

```bash
ls exports/vcb-jobs/ | grep -E "^${JOB_SLUG}-pending(-[0-9]+of[0-9]+)?\.jsonl$"
```

For each pending file, check the matching enriched file:
- `pending-NNofMM.jsonl` ↔ `enriched-NNofMM.jsonl`
- `pending.jsonl` ↔ `enriched.jsonl` (single-chunk job)

Build the **work list** by claiming chunks with the shared tool — do NOT hand-roll
this. The workspace is shared by concurrent sessions and file-based drains have no
`SKIP LOCKED` equivalent (measured 2026-08-26: two `pending_words` subagents found
another session's judgment already written into their chunk):

```bash
node scripts/lib/claim-chunks.mjs --dir exports/vcb-jobs \
     --in "${JOB_SLUG}-pending*.jsonl" --done 'pending:enriched' \
     --max <wave-size> [--force]
```

Spawn **only** what prints as `CLAIM`. `SKIP … 남이-잡음` means another session is on
it; `SKIP … 이미-완료` means the enriched file already exists. A claim older than 30
minutes is treated as dead and reclaimed (`STALE`) — sessions do get killed mid-wave.

Release when the wave ends, **including failed chunks** (a stale claim blocks that
chunk for 30 minutes):

```bash
node scripts/lib/claim-chunks.mjs --release <chunk paths>
```

⚠️ The old `.running.json` marker is gone. It was named here but never implemented,
and "live" was never defined — so it protected nothing.

Report the discovery summary:
```
job: <slug>
discovered: <total> chunk(s)
  to run:    <N>
  skipped:   <K> (reasons: enriched exists / running marker)
mode:        pilot | wave (size=N) | all-at-once
```

If the list is empty, stop with "nothing to do".

## Step 2 — Pre-flight (only for chunks you will run)

For each chunk in the work list:
- Verify the pending file exists and parses as JSONL (count lines)
- If `--force` AND enriched file exists, note that the worker will back it up

If `--pilot`: truncate the work list to its first entry.

## Step 3 — Fan out via Agent tool

For each chunk in the (possibly waved) work list, spawn a `vcb-enrich-chunk`
subagent via the Agent tool:

```
Agent(
  description: "Enrich chunk NNofMM",
  subagent_type: "vcb-enrich-chunk",
  prompt: <see template below>,
  run_in_background: true,
)
```

**Critical**: send the agents for ONE WAVE in a SINGLE message with multiple
Agent tool calls — that makes them run concurrently. Sending them in separate
messages serializes them.

### Per-agent prompt template

```
You are processing chunk {NNofMM} of the VCB enrichment pipeline.

Pending file (input):  {ABSOLUTE_PATH_TO_PENDING_JSONL}
Enriched file (output): {ABSOLUTE_PATH_TO_ENRICHED_JSONL}

{If --force was passed AND enriched file existed:}
The enriched file already exists. You were told --force. Back it up to
<enriched-file>.bak.<unix-timestamp> before writing your output.

Follow your role instructions (.claude/agents/vcb-enrich-chunk.md). The
authoritative schema and rules are at scripts/vcb/data/enrich-system-prompt.md.

When done, report back with the exact format specified in your role.
```

### Wave handling

- If `--wave-size 0` or omitted with all-at-once intent: send all N chunks in
  one message. They all run in parallel.
- Otherwise: send `wave-size` chunks in one message, wait for all to complete,
  then send the next wave.
- Each agent runs `run_in_background: true`. You'll get a notification when each
  one completes — do not poll or sleep.

## Step 4 — Aggregate

When all agents in all waves have reported back, aggregate:

```
========== VCB Batch Enrichment Report ==========
job:           <slug>
total chunks:  <N>
succeeded:     <X>  (enriched + validation PASS)
failed:        <Y>  (errors below)
skipped:       <Z>

Per-chunk:
  01of10  OK   pending=200 enriched=200 skipped=0 validation=PASS
  02of10  OK   pending=200 enriched=200 skipped=0 validation=PASS
  ...
  04of10  FAIL pending=200 enriched=187 skipped=0 validation=FAIL (BAD_EXAMPLES_COUNT × 13)

Failures (full detail):
  04of10: <error or validation summary>

Next steps:
  1. Inspect failed chunks (if any), re-run with /vcb-batch-enrich --chunks <NN> --force
  2. Import all enriched to DB:
     for f in exports/vcb-jobs/<slug>-enriched-*.jsonl; do
       pnpm vcb:import-enriched -- --file "$f"
     done
  3. Proceed to Step 6: pnpm vcb:qa
=================================================
```

Print the report as your final user-facing output. Do not exit silently.

## Convenience defaults

- Default model for subagents is Opus (defined in `vcb-enrich-chunk.md` frontmatter)
- Default wave-size is **3** — established as the rate-limit-safe ceiling
- Default behavior is **idempotent** — already-enriched chunks are skipped, not redone

## Failure modes & retries

- A subagent that fails validation does NOT block other subagents — collect
  results from all, then report
- Subagent OS-level errors (file IO, network) surface as `FAIL` with the error
  text — re-run that single chunk with `--chunks <NN> --force`
- A wave that times out (rare): the next wave still proceeds. Release the timed-out
  chunk's claim (`--release`) or wait 30 minutes for the automatic reclaim —
  do not delete `.claim` files by hand while other sessions may be running

## Anti-patterns (do not do these)

- Do not call `Bash(node scripts/vcb/run-enrich.mjs ...)` — that spawns
  `claude -p` subprocess, defeating the purpose of native Agent fan-out
- Do not loop over chunks calling the Agent tool one chunk per message — that
  serializes them. Always batch into a single message per wave.
- Do not pass the lexicographer system prompt inline in each agent prompt —
  agents read it from `scripts/vcb/data/enrich-system-prompt.md` themselves
- Do not write enriched files yourself — the subagents do that. You orchestrate.

## Example invocations

```
/vcb-batch-enrich 20260515-0737-cast-2000
  → runs all not-yet-enriched chunks, waves of 3, Opus default

/vcb-batch-enrich 20260515-0737-cast-2000 --pilot
  → runs only the first chunk (smoke test)

/vcb-batch-enrich 20260515-0737-cast-2000 --chunks 02,03,04 --wave-size 0
  → runs exactly those 3 chunks, all at once (parallel 3)

/vcb-batch-enrich 20260515-0737-cast-2000 --chunks 01 --force
  → re-enriches 01of10, backing up any existing enriched file
```
