# scripts/comic — Book → Comic pipeline

Turns a difficult book into a fun, character-driven **illustrated-science-comic**
(Larry-Gonick tradition): loose B&W art with dense **in-panel** text — narration
boxes + speech bubbles + **verbatim author quotes**.

Design rationale & full process review: the *"Book → Comic Pipeline"* artifact.

## Why it's built this way (the optimisation)

**Script-first.** A cheap text-LLM does the hard narrative work (adaptation) and
writes a structured **script JSON — the single source of truth**. The expensive
image step only *renders* it. Text is **never baked into the image**; it's laid
over the art as crisp HTML/CSS, so it stays editable, multilingual, and lets the
**age tiers share one set of art** (only the overlay text changes).

Verified comic-production order is kept; the four art stages (pencils→inks→colors)
collapse into **one image-gen call**, and lettering becomes **free** overlay.

## Pipeline

```
01-script   Phase A + GATE-1     source → validated script JSON
02-images   Phase C + GATE-2     script → one lightweight panel image each (free Flux)
02b-verify  Phase C' + GATE-2.5  analyze each panel → repair failing panels (defect-targeted)
03-assemble Phase D/E            script + images → Gonick-style HTML (per age tier)
```

### GATE-2.5 (analyze & repair) — `02b-verify.mjs`
Byte checks (GATE-2) only catch blank images; GATE-2.5 catches *wrong* images and
regenerates just those, keeping the rest untouched.

**Key elements analyzed** (per panel): ① scene fidelity ② figure count (extra/missing
people) ③ character identity / consistency (anchors present, matches other panels)
④ caption-zone clearance (the reserved `cap_zone` is empty) ⑤ style adherence.

**When (optimal timing):**
- Run **after 02-images, before 03-assemble** — repair is localized and cheap.
- Ideal is a **post-batch full pass** (all panels exist → can judge cross-panel drift),
  plus optional per-panel checks inside generation for the fastest feedback.

**How (repair escalation):** each failure carries issue **tags**; `refinePrompt` appends
defect-targeted constraints (e.g. `extra_figures` → "exactly N figures, no others";
`identity_drift` → re-assert the character anchor; `scene_mismatch` → re-assert the action)
plus a free-text `hint`. Attempts loop up to `--max`; from attempt 2 the prompt asks for a
*simpler composition*, and `--escalate` offsets the seed to escape a stuck generation while
keeping the anchor tokens (so identity holds). If nothing passes, the best is kept and
**logged in `qc-report.json`** — never silently accepted.

**Analyst (vision) — two modes:**
- `--api` : Anthropic vision (needs `ANTHROPIC_API_KEY`) → fully autonomous verify→repair→re-verify.
- `--verdicts <file>` : a JSON authored by Claude in-session (no key needed) —
  `{ "panels": [ { "n": 4, "verdict": "fail", "tags": ["extra_figures"], "hint": "no mummy" } ] }`.

**Optimal conditions:** use the **Seed token** (avoid throttling during repeated regen);
generate/repair the whole book in **one session** (limits style drift); keep repair
**localized** to failing panels; cap total regen. Identity defects that survive repair are a
signal to escalate to **T1 (IP-Adapter/LoRA)** — free Flux cannot lock identity by prompt alone.

```bash
# Claude in-session verdicts (works with no API key):
node scripts/comic/02b-verify.mjs --script out/script.json --images out/img \
  --verdicts qc.json --repair --escalate --max 3
# Fully autonomous (with ANTHROPIC_API_KEY):
node scripts/comic/02b-verify.mjs --script out/script.json --images out/img --api --repair
```

### GATE-1 (blocking) — `01-script.mjs`
Validates the script against the **real source text**:
- **Verbatim quote match** — every `quote` must be an exact substring of the source
  (condense with `…`; each fragment is checked in order). Catches misquotes.
- **Panel-count band**, **default-tier present on every panel**, coverage report.

### GATE-2 (blocking) — `02-images.mjs`
Each generated panel must exist and clear a minimum byte floor (blank/failed gen
is rejected and regenerated).

## Usage

```bash
# 1) validate a hand-authored (or Claude-authored) script against the source
node scripts/comic/01-script.mjs \
  --script scripts/comic/examples/darwin-drought.json \
  --out out/script.json

#    …or generate the script with Claude (needs ANTHROPIC_API_KEY):
node scripts/comic/01-script.mjs --api \
  --source gutenberg --ref 2009 --panels 12 --out out/script.json

# 2) generate the panel art (free, no key; skips panels already present)
node scripts/comic/02-images.mjs --script out/script.json --out out/img

# 3) assemble one page per age tier (art is shared; only text changes)
node scripts/comic/03-assemble.mjs --script out/script.json --images out/img \
  --tier teen  --out out/comic.teen.html
node scripts/comic/03-assemble.mjs --script out/script.json --images out/img \
  --tier child --out out/comic.child.html
```

## Character consistency (the #1 quality axis)

Prompt-only models cannot lock identity by reference, so consistency is engineered:

1. **Character-lightweighting (most important):** design each character SIMPLE and
   ICONIC — flat shapes + 1–2 unmistakable *shape* signatures — not richly detailed.
   Complex looks (wild hair, patchwork skin) render differently every panel; simple
   icons reproduce stably. Bonus: fewer lines → **smaller files** (helps the 50%
   size target). e.g. Victor = round head + round glasses + apron; the Creature =
   flat squarish head + big round eyes + jagged teeth (not "long lustrous hair,
   patchwork skin, watery eyes…"). buildImagePrompt appends a "draw characters
   simple and iconic" directive automatically.
2. **Signatures must read in grayscale** — final art is grayscaled, so lean on
   *shape* (glasses, square head, a scarf), not colour.
3. **Model-sheet lock:** one `canonical` + `anchor` phrase per character, injected
   verbatim into every panel; one fixed per-book `seed`.
4. **Fewer characters per panel** + distance composition for crowds.
5. **Consistency is a QC axis → rework:** GATE-2.5 evaluates identity drift like any
   other defect; `identity_drift` panels are reworked by the loop-until-pass process.
6. **When free Flux still drifts** on a hard design → escalate to **T1 (IP-Adapter/
   LoRA)** with a reference model-sheet (paid/self-host).

Empirically (Frankenstein Ch.5): switching Victor from "wild dark hair" to
"round glasses + neat hair + apron" made him consistent across all panels; the
Creature's simplified icon (googly eyes + lanky) held far better than the old
patchwork design; average image dropped to ~34 KB (**~56% smaller**).

### Which signature features actually hold — derived from a controlled test
Generating three test characters (each dominated by a different feature type)
together across three very different scenes showed a clear ranking:

| feature | reliability | note |
|---|---|---|
| hard **headgear / accessory**, stated *positively* (top hat, round glasses, bald, bowtie) | ★★★★★ | top hat & glasses persisted in **100%** of scenes |
| **silhouette / height** (very tall vs short-round) | ★★★ | helps at distance; homogenises in groups |
| **hairstyle** | ★★ | an afro drifted to spiky/mohawk; only *bald* is stable |
| bold single **garment** | ★★ | secondary; can be cropped/occluded |
| **face detail, colour** | ★ | do not rely on it (final art is grayscale) |
| a **negative** ("NO glasses") or fine trait | ✗ | ignored — the model added the dominant motif to everyone |

**Rules that follow:**
1. Give each character **one unique, positive, hard signature** — ideally headgear/
   accessory — that no other cast member shares. Never distinguish characters by
   hairstyle or by the *absence* of a feature.
2. **Prefer solo panels.** In a shared frame prompt-only Flux **homogenises** the cast
   (everyone drifts to a common look), so multi-character distinctness is unreliable;
   when unavoidable, use a **large silhouette/height gap** and spatial separation.
3. **Pick signatures the model actually renders** — top hat / glasses / bald work;
   "flat square head + neck bolts" did not. Test a new signature before adopting it.

## Script schema

See `schema.mjs` (`validateStructure`) for the enforced shape. Key idea: panels
carry tier-agnostic `scene`/`composition`/`characters` (for image gen) and a
per-tier `text` map (`narration` / `bubbles` / `quote` / `labels`) for lettering.
`cast[].anchor` + `seed_role` are the free character-consistency mechanism
(distinctive prop + fixed seed); multi-character panels use distance composition.

## Files

| file | phase |
|---|---|
| `schema.mjs` | script schema + structural validator |
| `lib.mjs` | source fetch · GATE-1 · image gen + GATE-2 · HTML assembly |
| `01-script.mjs` | Phase A + GATE-1 (CLI) |
| `02-images.mjs` | Phase C + GATE-2 (CLI) |
| `03-assemble.mjs` | Phase D/E (CLI) |
| `examples/darwin-drought.json` | worked example (12 panels, verified quotes) |

## Notes

- Free image backend: **Pollinations (Flux)** — prompt-only. It can't do
  reference-conditioning, so consistency relies on anchor+seed+distance (tier T0).
  Higher consistency (IP-Adapter / LoRA) needs a self-hosted or paid backend.
- **Auth (Seed+ tier)** — anonymous is 1 req/15s. Registering (auth.pollinations.ai)
  gives Seed tier: 1 req/5s (3× faster) + no watermark. Provide the token WITHOUT
  committing it, via either:
  - env var: `POLLINATIONS_TOKEN=xxx`, or
  - a gitignored file: `scripts/comic/.pollinations-token` (contents = the token only).
  `02-images.mjs` picks it up automatically and prints `authenticated (Seed+ tier)`.
  The token is a secret — it is `.gitignore`d and must never be pasted into shared chat.
- Coverage for a **concept** adaptation (e.g. Darwin) = thematic beat completeness,
  not whole-book contiguity; for a **narrative** book it's literal offset coverage.
- Migrations for the DB tables (`comic_adaptations` etc.) are **not** auto-applied —
  see the design artifact and apply after approval.
