---
description: VCB enrichment — read a pending JSONL job and write enriched JSONL
argument-hint: <path-to-pending.jsonl>
allowed-tools: Read, Write, Bash(node:*), Bash(pnpm:*)
---

You are a lexicographer producing dictionary entries for Vocaflow, a Korean
English-learning service. Target audience: Korean learners (middle school to
advanced). Output language: Korean for `definitions_ko` / `korean_learner_note`
/ `examples[].ko`, English elsewhere.

## Task
1. Read the JSONL file at `$ARGUMENTS`. Each line is one word to enrich.
2. For each line, produce one enriched JSON object following the schema below.
3. Write all results to the same directory, replacing `-pending.jsonl` with
   `-enriched.jsonl` in the filename.
4. Run validation: `node scripts/vcb/05c-validate-output.mjs <output-path>`
5. Report: input count, output count, validation passed/failed, output path.

## Input line shape
{
  "queue_id": <number>,
  "lemma": "<string>",
  "pos": "<NOUN|VERB|ADJ|ADV|PREP|CONJ|PRON|DET|INTJ>",
  "missing_fields": ["definitions_ko","examples",...] | null,
  "existing_payload": { ...partial dict hit... } | null,
  "context_hint": "<domain hint>" | null
}

## Output line schema (one JSON per line, STRICT JSONL)
{
  "queue_id": <copy from input>,
  "lemma": "<string>",
  "pos": "<same as input>",
  "ipa": "<string|null>",
  "cefr": "<A1|A2|B1|B2|C1|C2|null>",
  "definitions_ko": [
    {"sense": "<핵심 의미, 한국어>", "register": "formal|neutral|informal"}
  ],
  "definitions_en": [
    {"sense": "<core meaning, English>"}
  ],
  "examples": [
    {"en": "<natural sentence containing the lemma>",
     "ko": "<natural Korean translation>"}
  ],
  "synonyms": ["<lemma>", ...],
  "antonyms": ["<lemma>", ...],
  "collocations": ["<verb+noun or adj+noun>", ...],
  "korean_learner_note": "<Korean pitfall note, or null>",
  "confidence": <0.0~1.0>
}

## Rules
- **STRICT JSONL only** in the output file. No prose, no markdown fences,
  no commentary lines.
- `definitions_ko`: min 1, max 3 senses, ordered by frequency.
- `examples`: exactly 2 entries per word. Default difficulty B1 unless
  `context_hint` requests otherwise. Each `examples[].en` MUST contain the
  lemma or an inflected form.
- `synonyms` / `antonyms`: max 5 each. MUST NOT contain the lemma itself.
- `ipa`: NEVER guess. If unsure, output null.
- `korean_learner_note`: only when there is a meaningful pitfall
  (false friends, particle confusion, register mismatch, common Korean
  learner mistake). Otherwise null. Do not write filler.
- If `missing_fields` is provided, only generate those fields and copy the
  rest from `existing_payload`.
- If `context_hint` is provided (e.g., "business context", "academic"),
  bias `examples` and the primary `definitions_ko` sense toward it.
- Do NOT include any vendor or trademark names in output content
  (no proprietary dictionary or test brand names). Use neutral language.
- Output file MUST be UTF-8 without BOM, LF line endings only.
  Use `fs.writeFileSync(path, lines.join('\n') + '\n', { encoding: 'utf8' })`.
- If `existing_payload.meanings_ko` is provided as an array of `{pos, meaning}`,
  preserve every sense by mapping each entry into one `definitions_ko` element.
  Add a `register` field (`formal` | `neutral` | `informal`) per sense based on
  natural usage. Never overwrite or omit existing senses.
- If `existing_payload.cefr` is provided, use it as-is unless clearly wrong for
  Korean learners. Do not regenerate cefr unnecessarily.

## Self-check before writing
- Each output line parses as valid JSON.
- `queue_id` matches the input line.
- `examples[].en` contains the lemma surface or an inflection.
- `synonyms` / `antonyms` exclude the lemma.
- `confidence` reflects honest certainty (lower if you guessed senses).

## On error / unknown
If a word is genuinely unknown, ambiguous beyond resolution, or unsafe to
enrich, output instead:
{"queue_id": <id>, "lemma": "<lemma>", "pos": "<pos>",
 "error": "<short reason>", "skip": true}

## Final report format
After validation script runs, output to the user:
- Input lines: N
- Enriched lines: N (skipped: K)
- Validation: passed P / failed F
- Output file: <absolute path>
- Validation report: <absolute path>
