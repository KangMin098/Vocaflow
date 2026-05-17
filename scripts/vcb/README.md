# scripts/vcb/ — VCB (Vocabulary Build) Pipeline

8-step pipeline that builds and maintains `shared_dictionary` (영단어 마스터 캐시 — see CLAUDE.md §19).

```
Step 1  Seed list   /vcb-seed-list              generate lemma list from spec
                    /vcb-seed-validate          ← OPTIONAL: LLM compare vs refs + purpose/level check (RECOMMENDED before Step 2)
                    01c-validate-seed-list.mjs  schema-only check (auto-run by /vcb-seed-list)
Step 2  Normalize   pnpm vcb:normalize          dedupe + cache lookup
Step 3  Queue load  (implicit Step 2)           vocab_enrichment_queue (DB)
Step 4  Batch split (implicit Step 2/5a)        200-line chunks
Step 5  Enrichment  ★ LLM step (the bottleneck) ★
  5a  export-job   pnpm vcb:export-job          DB queue → pending JSONL chunks
  5b  enrich       /vcb-batch-enrich            ← NATIVE BATCH PATH (recommended)
                   /vcb-enrich (single chunk)   ← legacy / one-off use
  5c  validate     pnpm vcb:validate-output     schema + JSONL sanity
  5d  import       pnpm vcb:import-enriched     enriched JSONL → DB (idempotent)
Step 6  QA gate    pnpm vcb:qa                  R1~R8 rules → flags
Step 7  Curation   /vcb-curate-compare          ← OPTIONAL: LLM compare vs reference files (Anki/NGSL/domain)
                   /admin/vocab/curate/[run_id] human review (final decision)
Step 8  Publish    pnpm vcb:publish             → shared_dictionary upsert
```

---

## Step 5b — Batch Enrichment via Claude Code (the convenient path)

**Use `/vcb-batch-enrich` from inside a Claude Code session in VS Code.** It is
the recommended way to process Step 5b at scale.

```
/vcb-batch-enrich <job-slug> [--chunks 01,02,...] [--pilot] [--wave-size 3] [--force]
```

### What it does

The slash command makes the current Claude Code session act as an **orchestrator**:

1. Discovers all `{job-slug}-pending-NNofMM.jsonl` chunks under `exports/vcb-jobs/`
2. Skips chunks that already have a valid enriched file (unless `--force`)
3. Spawns one `vcb-enrich-chunk` subagent per chunk **in parallel** via the Agent tool
4. Each subagent reads its chunk, generates 200 enriched JSON entries, writes the
   `enriched-NNofMM.jsonl` file, and runs validation
5. Orchestrator aggregates results into one final report

This is true native fan-out — no `claude -p` subprocess overhead, no external API
key, visible in the VS Code Agent panel.

### Convenience flags

| Flag | Effect |
|---|---|
| `--pilot` | Run **only the first chunk** in the work list, then stop. Use to spot-check quality and the pipeline plumbing before committing 9 parallel agents. |
| `--chunks 02,03,04` | Restrict to specific chunk numbers (NN of NNofMM). |
| `--wave-size 3` | Process in waves of N (default **3** for rate-limit safety). `--wave-size 0` to fan out everything at once. |
| `--force` | Re-enrich chunks whose enriched file already exists. The subagent backs up the existing file to `*.bak.<ts>` before writing. |

### Recommended workflow

```
# 1. Pilot one chunk first (smoke test)
/vcb-batch-enrich 20260515-0737-cast-2000 --pilot

# 2. Inspect: validation passed? quality looks right? Then fan out:
/vcb-batch-enrich 20260515-0737-cast-2000

# 3. After all chunks complete, import to DB
for f in exports/vcb-jobs/20260515-0737-cast-2000-enriched-*.jsonl; do
  pnpm vcb:import-enriched -- --file "$f"
done

# 4. Proceed to QA gate
pnpm vcb:qa
```

### Authoritative system prompt

`scripts/vcb/data/enrich-system-prompt.md` is the single source of truth for the
lexicographer schema, rules, register guidelines, edge cases, and worked
examples. Both the slash command and the subagent role read from this file.

### Related files

| File | Purpose |
|---|---|
| `.claude/commands/vcb-batch-enrich.md` | Slash command body — orchestrator runbook |
| `.claude/agents/vcb-enrich-chunk.md` | Subagent role — per-chunk worker |
| `scripts/vcb/data/enrich-system-prompt.md` | Lexicographer system prompt (shared) |
| `scripts/vcb/05c-validate-output.mjs` | Schema validator (run by each subagent) |
| `scripts/vcb/05d-import.ts` | DB write-back (next step after enrichment) |

---

## Step 1 — Seed Safety Net via Claude Code (semantic validation)

Before normalizing and loading the seed into DB (Step 2), validate the
AI-generated seed list against reference files + the spec's stated purpose:

```
/vcb-seed-validate <seed-list.jsonl> [--spec <path>] [--refs <dir-or-paths>] [--chunk-size 500] [--wave-size 3]
```

### Why this matters

Pure AI seed generation can:
- **Drift in level** — asked for B1, produces some C2 words mixed in
- **Drift in domain** — asked for TOEIC, throws in random general vocab
- **Miss must-have words** — forgets core TOEIC top-100 essentials
- **Include duplicates** — `cat` + `cats`, `run` + `running`
- **Pollute with excluded items** — words that should NOT be in this list

`/vcb-seed-validate` catches these BEFORE you enrich (Step 5b) — much cheaper
than discovering quality issues after spending Opus tokens on bad lemmas.

### What it checks

Same fan-out pattern as `/vcb-batch-enrich` and `/vcb-curate-compare`. Each
subagent (`vcb-seed-validator`) judges per-lemma:

| Check | What |
|---|---|
| `level_fit` | `cefr_estimate` in `target_cefr_range`? |
| `domain_fit` | Lemma's typical usage matches `target_segment` + `domain_hints`? |
| `must_cover_hits` | Lemma in any `must-cover` ref? Positive signal. |
| `frequency_floor_status` | Lemma in any `frequency-floor` ref? Out → flag. |
| `exclude_hits` | Lemma in any `exclude` ref? → remove. |
| `spec_keyword_status` | In `must_include_keywords` / `must_exclude_keywords`? |

Verdict: `keep` / `review` / `remove` per lemma + confidence + rationale.

### Global checks (orchestrator-level)

The orchestrator computes globals across all chunks:

- **`must_cover_misses`** — words IN must-cover refs but NOT in seed (curator
  must add them, or remove them from the must-cover ref)
- **`duplicate_lemmas`** — case-insensitive duplicates in the seed
- **`distribution_check`** — total count vs target, CEFR distribution, POS mix
- **`spec_keyword_completeness`** — `must_include` all present? `must_exclude`
  all absent?

### Reference setup

Same shape as Step 7. Place at `data/seed-references/<slug>/` (or reuse
`data/curation-references/<slug>/` — they're symmetric). Most important:
`reference-meta.json` with role-tagged references (must-cover / frequency-floor
/ exclude / supplement).

### Workflow

```bash
# 1. Generate seed
/vcb-seed-list data/specs/cast-2000-seed-spec.json

# 2. Validate against references + purpose
/vcb-seed-validate exports/vcb-jobs/20260515-0737-cast-2000-seed-list.jsonl

# 3. Open the report, fix gaps:
#    - Add must_cover_misses to seed (or amend must-cover ref)
#    - Remove polluting / off-level / off-domain lemmas
#    - Re-run /vcb-seed-validate to confirm clean

# 4. Proceed to Step 2
pnpm vcb:normalize
```

### Output

```
exports/vcb-jobs/<slug>-seed-validation-<YYYYMMDD>/
├── summary.json              ← totals + distribution + coverage
├── summary.md                ← curator entry point
├── coverage-report.md        ← must_cover_misses (most actionable output)
├── chunk-01.seed-validation.jsonl  ← per-lemma verdicts (machine)
├── chunk-01.seed-validation.md     ← per-lemma cards (curator)
└── ...
```

### Related files

| File | Purpose |
|---|---|
| `.claude/commands/vcb-seed-validate.md` | Slash orchestrator |
| `.claude/agents/vcb-seed-validator.md` | Subagent role (per-chunk validator) |
| `scripts/vcb/01c-validate-seed-list.mjs` | Schema-only validator (POS, CEFR enum) — auto-run by `/vcb-seed-list` |
| `scripts/vcb/data/reference-formats.md` | Reference file shape guide (shared with Step 7) |

---

## Step 7 — Reference Comparison via Claude Code (curation assist)

Before the human curator opens `/admin/vocab/curate/[run_id]`, you can run a
**LLM-powered comparison** of enriched entries against reference files you've
prepared (Anki decks exported as CSV, NGSL frequency lists, domain glossaries).

```
/vcb-curate-compare <job-slug> [--refs <dir-or-paths>] [--chunks 01,02] [--wave-size 3]
```

### What it does

Same fan-out pattern as `/vcb-batch-enrich`, but each subagent
(`vcb-curation-comparator`) takes one enriched chunk + N reference files and
produces:

- A **per-word verdict** (`approve` / `review` / `reject`) with confidence
- A **rationale** naming which reference triggered which judgment
- A **curator_attention** list — specific points to verify
- Aggregate `summary.md` ranking concerns

The curator then opens the comparison report alongside the curation UI and
spends time on `reject` + `review` first, batch-approving the `approve` items.

### Reference file prep (user's responsibility)

Place reference files at `data/curation-references/<job-slug>/` in one of:

- **CSV / TSV** — with at minimum `word` column; richer shapes welcome
- **JSON / JSONL** — same field names as CSV columns
- **Plain `.txt`** — one word per line (coverage check only)

Recommended additional file: **`reference-meta.json`** describing each
reference's role (`must-cover` / `should-cover` / `frequency-floor` /
`supplement` / `exclude`) and target CEFR band / frequency rank.

Full reference format guide: `scripts/vcb/data/reference-formats.md`.

### Anki specifically

In Anki: **Browse → Select your deck → File → Export → Notes in Plain Text**.
Save with `.csv` extension and (if tab-separated) rename or convert to comma
separator. Rename columns to match the standard shape — `word`, `meaning_ko`,
`example_en`, `level` are recognized.

### Output

```
exports/vcb-jobs/<slug>-curation-compare-<YYYYMMDD>/
├── summary.json              ← aggregate stats + run metadata
├── summary.md                ← human overview + top concerns
├── chunk-01of10.compare.jsonl ← per-word verdicts (machine-readable)
├── chunk-01of10.compare.md    ← per-word verdicts (curator-readable)
├── chunk-02of10.compare.jsonl
└── ...
```

### Related files

| File | Purpose |
|---|---|
| `.claude/commands/vcb-curate-compare.md` | Slash orchestrator |
| `.claude/agents/vcb-curation-comparator.md` | Subagent role (per-chunk worker) |
| `scripts/vcb/data/reference-formats.md` | Reference file shape guide |

---

## Step 5b — alternate paths (kept for reference)

These exist for one-off, debugging, or special use cases. The native batch path
above should be the default for any multi-chunk job.

| Path | When to use |
|---|---|
| `/vcb-enrich <pending-file>` | Single chunk, manual. Same prompt body as the subagent role but inline. |
| `scripts/vcb/05b-parallel.mjs` | Subprocess fan-out via `claude -p`. Useful from CI or non-Claude-Code shells. |
| `scripts/vcb/05b-batch-submit.mjs` + `05b-batch-poll.mjs` | Anthropic Message Batches API (SDK). 50% discount + truly async, requires `ANTHROPIC_API_KEY`. |

---

## Idempotency guarantees

| Step | Guard | Override |
|---|---|---|
| 5b orchestrator | skips chunks with existing enriched file | `--force` |
| 5b subagent | refuses to overwrite without `--force` | passed by orchestrator |
| 5c validate | always runs (read-only) | — |
| 5d import (`05d-import.ts`) | DB pre-check: row already `status='enriched'` is skipped | `--force` |
| `run-enrich.mjs` (legacy subprocess) | exits 3 if enriched file exists | `--force` flag, auto `.bak` |

---

## Authoritative reference

- Pipeline overview: CLAUDE.md §19 (VCB)
- Schema: CLAUDE.md §"🗄 Supabase DB 스키마" → `vocab_enrichment_queue`
- Lexicographer system prompt: `scripts/vcb/data/enrich-system-prompt.md`
