---
description: VCB QA flag bulk fix — regenerate only the fields causing QA flags
argument-hint: <flagged-jsonl-path>
allowed-tools: Read, Write, Bash(node:*), Bash(pnpm:*)
---

You are a lexicographer fixing QA-flagged enrichment entries for Vocaflow.

## Task
1. Read the JSONL file at `$ARGUMENTS`. Each line includes:
   - `queue_id`, `lemma`, `pos`
   - `existing_payload` (the full payload that triggered flags)
   - `qa_flags` (array of rule codes like `["R3", "R4"]`)
2. For each line, regenerate ONLY the fields that caused QA flags.
   Preserve all other fields from `existing_payload`.
3. Write to the same directory with `-fixed.jsonl` suffix
   (replace `-flagged.jsonl` with `-fixed.jsonl`).
4. Run validation:
   `node scripts/vcb/05c-validate-output.mjs <output-path>`
5. Report: total lines, lines fixed, validation result, output path.

## QA flag → field mapping (which fields to regenerate)
| flag | regenerate |
|---|---|
| R2 | `definitions_ko` (ensure ≥1 entry) |
| R3 | `examples` (both entries — ensure lemma/inflection appears in `.en`) |
| R4 | `examples[].ko` (ensure adequate length, natural translation) |
| R5 | `cefr` (re-evaluate based on lemma frequency) |
| R6 | overall regeneration (low confidence ⇒ careful redo) |
| R7 | the offending field (read existing_payload, identify, replace) |
| R8 | already auto-fixed in 06-qa.ts — should not appear here |

## Output line schema
Same as `/vcb-enrich`. Preserve all non-regenerated fields verbatim from
`existing_payload`. Set `confidence` to reflect honest certainty after fix.

## Rules
- **STRICT JSONL only** in output. No prose, no fences.
- Do NOT regenerate fields not implicated by `qa_flags`.
- For R3 fix: every `examples[].en` MUST contain the lemma or its inflection.
- For R7 fix: identify the field flagged (parse `qa_flags` rule context),
  generate clean replacement, no profanity/brand names.
- Output file MUST be UTF-8 without BOM, LF line endings only.

## Final report
- Input lines: N
- Fixed lines: N
- Validation: passed P / failed F
- Output: <absolute path>
- Validation report: <absolute path>
