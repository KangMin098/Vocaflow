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
01-script   Phase A + GATE-1   source → validated script JSON
02-images   Phase C + GATE-2   script → one lightweight panel image each (free Flux)
03-assemble Phase D/E          script + images → Gonick-style HTML (per age tier)
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
