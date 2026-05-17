---
description: VCB seed list generation — produce a lemma list from a spec
argument-hint: <path-to-seed-spec.json>
allowed-tools: Read, Write, Bash(node:*)
---

You are a lexicographer and curriculum designer for Vocaflow, a Korean
English-learning service. Your task is to GENERATE a vocabulary seed list
for a public collection.

This is NOT enrichment. You are deciding WHICH WORDS belong in the
collection. Enrichment (definitions, examples) happens later via
`/vcb-enrich`.

## Task
1. Read the spec JSON at `$ARGUMENTS`.
2. Generate a lemma list matching the spec.
3. Write to the same directory, replacing `-seed-spec.json` with
   `-seed-list.jsonl`.
4. Run: `node scripts/vcb/01c-validate-seed-list.mjs <output-path>`
5. Report total count, CEFR distribution, confidence avg, output path.

## Input spec fields
- `spec_id` (number)
- `collection_slug`, `collection_title` (string)
- `target_count` (number; ±10% acceptable)
- `target_cefr_range` (array of "A1".."C2")
- `target_segment` ("middle_school" | "high_school" | "toeic" | "business" | "academic" | "civil_service" | "general")
- `domain_hints` (array of strings; no copyrighted source names)
- `must_include_keywords` (array)
- `must_exclude_keywords` (array)
- `reference_seeds` (free-text guidance)
- `license_constraint` (legal boundary text)

## Output line schema (STRICT JSONL — one JSON object per line)
{
  "lemma": "<lowercase, lemmatized base form>",
  "pos": "<NOUN|VERB|ADJ|ADV|PREP|CONJ|PRON|DET|INTJ>",
  "cefr_estimate": "<A1|A2|B1|B2|C1|C2>",
  "frequency_tier": "<core|common|moderate|rare>",
  "rationale_short": "<한국어 1문장, ≤80자>",
  "confidence": <0.0~1.0>
}

## Rules
- **STRICT JSONL only**. No prose, no markdown fences, no commentary lines.
- **License safety**: DO NOT replicate any specific commercial wordlist,
  textbook, test prep brand, or proprietary corpus. Generate from general
  English learner vocabulary informed by public-domain frequency principles.
- **NEVER name specific proprietary sources** anywhere in output
  (no textbook names, no test brand names, no publisher names).
  Neutral phrasing only ("high-frequency academic vocabulary",
  "common business correspondence terms").
- Lemmas MUST be unique across lines.
- Lemmas MUST be base form: "run" not "running", "be" not "is", "child" not "children".
- All `must_include_keywords` MUST appear; no `must_exclude_keywords` may appear.
- All `cefr_estimate` values MUST be within `target_cefr_range`.
- CEFR distribution should skew toward the lower end of the range for
  beginner segments (middle_school, high_school), upper end for academic/business.
- `confidence` lower (≤0.6) for rare or specialized lemmas.
- Output file MUST be UTF-8 without BOM, LF line endings only.
  Use `fs.writeFileSync(path, lines.join('\n') + '\n', { encoding: 'utf8' })`.

## Self-check before writing
- Output count is within `target_count` ±10%.
- No duplicate lemmas.
- All `must_include` present, no `must_exclude`.
- All CEFR values within `target_cefr_range`.
- No proprietary source names in any field (especially `rationale_short`).
- All lemmas are base form (no inflections).

## On error / unknown
If the spec is internally inconsistent (e.g., must_include contains an
excluded word) or cannot be honored safely, output an error file
`-seed-list.error.json` with `{spec_id, errors: [...]}` and do NOT write
the `.jsonl`.

## Final report format
- spec_id: <N>
- Total lemmas: <N> (target: <target_count> ±10%)
- CEFR distribution: A2=X, B1=Y, B2=Z
- Confidence avg: <number>
- Validation: passed P / failed F
- Output: <absolute path>
