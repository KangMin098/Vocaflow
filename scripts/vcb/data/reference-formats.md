# VCB Curation — Reference File Formats

Use these formats when preparing reference files for `/vcb-curate-compare`.
Place files under `data/curation-references/{job-slug}/` or pass paths
explicitly with `--refs`.

The comparator is permissive about extra columns — only the **required** columns
must be present with the exact names below (case-sensitive, lowercase).

---

## CSV / TSV (recommended)

UTF-8, LF line endings preferred. First row = header.

### Minimum shape (word list only)

```csv
word
impression
impressive
improvement
```

Use when you only want to check **coverage / seed-list fit** (does our entry
exist in the reference? what's the overlap?).

### Standard shape (word + meaning)

```csv
word,meaning_ko
impression,인상; 감명
impressive,인상적인
improvement,향상; 개선
```

Use for definition comparison. Multiple senses separated by `;` or `/`.

### Rich shape (Anki-style)

```csv
word,pos,meaning_ko,example_en,level,note
impression,n,"인상, 감명","She made a good impression on her boss.",B1,
impressive,adj,인상적인,"Her performance was truly impressive.",B1,
improvement,n,"향상, 개선","Significant improvement in his English.",B1,common confusion: improvement in vs on
```

Recognized columns:

| Column | Required | Notes |
|---|---|---|
| `word` | ✅ | The lemma — lowercase preferred; matched case-insensitively |
| `pos` | — | `n, v, adj, adv, prep, conj, pron, det, intj` or `NOUN, VERB, ...` |
| `meaning_ko` | — | Korean meaning(s), `;` or `/` separator |
| `meaning_en` | — | English gloss |
| `example_en` | — | One example sentence |
| `example_ko` | — | Korean translation of example |
| `level` | — | `A1`~`C2` or `1`~`6` (auto-mapped) |
| `frequency_rank` | — | Integer rank in the source corpus |
| `tags` | — | Comma-separated tags (used as labels) |
| `note` | — | Free text — surfaced in the comparison report |

Any other columns are preserved as `extra.{column_name}` in the JSON output for
LLM context but are not used as primary comparison fields.

---

## Anki export (`.csv` from Anki Browse)

In Anki:
1. **Browse → Select your deck**
2. **File → Export...**
3. **Export format**: "Notes in Plain Text (.txt)" → save as `.csv` (Anki uses
   tab separator by default — pass as TSV, OR re-save with CSV separator)
4. **Include**: tags, scheduling info (optional, ignored by comparator)
5. Place at `data/curation-references/{job-slug}/anki-{deck-name}.csv`

**Anki note types vary widely.** Most decks have at least Front/Back fields.
Map them to our columns:

| Anki field | Map to |
|---|---|
| Front | `word` |
| Back | `meaning_ko` (or split into `meaning_ko` + `example_en` if Back contains both) |
| Example | `example_en` |
| Pronunciation | (preserved as extra, not compared) |
| Tags | `tags` |

If your Anki deck has non-standard fields, rename column headers to match the
standard shape above before saving. The orchestrator will not guess field
meanings.

---

## JSON / JSONL

### JSONL (recommended for large lists)

One entry per line:

```jsonl
{"word":"impression","meaning_ko":"인상, 감명","level":"B1","frequency_rank":1542}
{"word":"impressive","meaning_ko":"인상적인","level":"B1","frequency_rank":2103}
```

### JSON array

```json
[
  {"word":"impression","meaning_ko":"인상, 감명","level":"B1"},
  {"word":"impressive","meaning_ko":"인상적인","level":"B1"}
]
```

Field names follow the same column conventions as CSV.

---

## Plain text (word list)

UTF-8, one word per line:

```
impression
impressive
improvement
```

Equivalent to CSV with only the `word` column. Useful for raw frequency lists
(NGSL top-N, COCA top-N, GSL, etc.).

---

## NGSL / GSL / academic word list special cases

These are already in the database as part of the `shared_dictionary` seed (see
CLAUDE.md §"NGSL Project"). You typically do NOT need to provide them as
reference files — the comparator can pull them from DB if you pass
`--include-db-refs ngsl,nawl,bsl` (Phase 2).

For now, if you want to compare against NGSL Top-2000 specifically, export from
the DB:

```sql
SELECT word, frequency_rank
FROM shared_dictionary
WHERE 'NGSL' = ANY(list_tags) AND frequency_rank <= 2000
ORDER BY frequency_rank;
```

Save as `data/curation-references/{job-slug}/ngsl-top-2000.csv`.

---

## Reference file naming convention

```
data/curation-references/
└── 20260515-0737-cast-2000/         ← job-slug (matches pending JSONL prefix)
    ├── anki-toeic-700.csv           ← Anki deck export
    ├── anki-suneung-vocab.csv       ← another Anki deck
    ├── ngsl-top-2000.csv            ← frequency reference
    ├── domain-business.csv          ← user-curated domain list
    └── reference-meta.json          ← (optional) describes purpose of each file
```

### `reference-meta.json` (optional but recommended)

Helps the comparator weight each reference appropriately:

```json
{
  "purpose": "필수 2000 단어 (cast-2000) — TOEIC + 수능 + 비즈니스 영어 균형",
  "target_cefr_band": ["A2", "B2"],
  "target_frequency_rank_max": 2500,
  "references": {
    "anki-toeic-700.csv": {
      "role": "must-cover",
      "description": "TOEIC 빈출 700 단어 — 가능한 모두 포함되어야 함",
      "weight": 1.0
    },
    "anki-suneung-vocab.csv": {
      "role": "must-cover",
      "description": "수능 영어 어휘 — 한국 학습자 핵심",
      "weight": 1.0
    },
    "ngsl-top-2000.csv": {
      "role": "frequency-floor",
      "description": "이 목록 밖 단어는 빈도 낮음 — 포함 시 사유 명시",
      "weight": 0.7
    },
    "domain-business.csv": {
      "role": "supplement",
      "description": "비즈니스 도메인 보완 — 일부만 포함되어도 OK",
      "weight": 0.3
    }
  }
}
```

`role` values:

| Role | Meaning |
|---|---|
| `must-cover` | Every word in this ref SHOULD be in our enriched set. Missing words flagged. |
| `should-cover` | High overlap expected, low overlap flagged as concern. |
| `frequency-floor` | Words OUTSIDE this ref's top-N flagged as "below seed target level". |
| `supplement` | Optional supplement — low overlap is fine, no flags. |
| `exclude` | Words IN this ref should NOT be in our enriched (e.g., already-known beginner words). |

---

## What the comparator does NOT do

- Parse `.apkg` directly (export to CSV first — Phase 2 may add SQLite support
  via `better-sqlite3` which is already in the workspace)
- Parse `.xlsx` directly (save as CSV in Excel/Sheets first)
- Parse PDF or scanned documents
- Fetch URLs (your references must be local files)
- Translate reference content — references are taken as ground truth

If a reference file has a format the comparator cannot read, the orchestrator
will fail fast with a clear error and a pointer back to this guide.
