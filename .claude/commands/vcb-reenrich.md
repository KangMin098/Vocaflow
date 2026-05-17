---
description: VCB single-word re-enrichment — regenerate one queue item with optional curator instruction
argument-hint: <queue-id> [instruction]
allowed-tools: Read, Write, Bash(node:*), Bash(pnpm:*)
---

You are a lexicographer producing a dictionary entry for Vocaflow, a Korean
English-learning service. This command re-enriches a SINGLE queue item.

## Task
1. Parse `$ARGUMENTS` as `<queue-id> [optional instruction]`.
2. Write a temporary one-line input JSONL at
   `exports/vcb-jobs/reenrich-<queue-id>.jsonl` with the queue row's shape:
   `{queue_id, lemma, pos, missing_fields, existing_payload, context_hint}`.
   If you don't have direct DB access from Claude Code, ask the user to
   first run: `pnpm vcb:export-job --run-id <auto> --limit 1` for a single
   item — or provide the shape inline if known.
3. Produce one enriched JSON line matching `/vcb-enrich` output schema.
4. If `instruction` is provided in $ARGUMENTS, apply it as an extra
   constraint (e.g., "make examples more business-context", "use formal
   register only").
5. Write to `exports/vcb-jobs/reenrich-<queue-id>-enriched.jsonl`.
6. Run validation:
   `node scripts/vcb/05c-validate-output.mjs exports/vcb-jobs/reenrich-<queue-id>-enriched.jsonl`
7. Print the JSON line + a one-line summary.

## Output schema (one JSON line, no JSONL wrapper)
Same as `/vcb-enrich` output schema. See `.claude/commands/vcb-enrich.md`.

## Rules
- This is for re-enrichment after curator review. Assume the previous
  enrichment had issues — be more careful with:
  - `examples[].en` MUST contain the lemma or its inflection
  - `synonyms` / `antonyms` MUST NOT contain the lemma itself
  - `confidence` should reflect any uncertainty honestly
- If `instruction` is provided, prioritize it over default policy.
- If `existing_payload.meanings_ko` is provided as `{pos, meaning}` array,
  preserve all senses (same rule as `/vcb-enrich`).
- Output file MUST be UTF-8 without BOM, LF line endings only.
- Do NOT auto-import. Curator will manually import via UI or
  `pnpm vcb:import-enriched`.

## Final report
- queue_id: <N>
- lemma: <word>
- previous payload existed: <yes|no>
- instruction applied: <yes|no>
- validation: passed | failed (errors: ...)
- output path: <absolute>
