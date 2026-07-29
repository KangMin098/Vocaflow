// scripts/comic/01-script.mjs
// Phase A + GATE-1. Load (or, with --api, generate) a comic script, then
// validate it against the real source text: structure, verbatim quote match,
// coverage contiguity, and panel-count band. Writes the validated script.
//
// Usage:
//   node scripts/comic/01-script.mjs --script examples/darwin-drought.json --out out/script.json
//   node scripts/comic/01-script.mjs --api --book-title "..." --author "..." \
//        --source gutenberg --ref 2009 --panels 12 --out out/script.json
//
// --api requires ANTHROPIC_API_KEY and @anthropic-ai/sdk (already a dep).

import fs from "fs";
import path from "path";
import { validateStructure } from "./schema.mjs";
import { fetchSource, gate1 } from "./lib.mjs";

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : true;
}

async function generateWithApi() {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const source = await fetchSource({ source: arg("source"), ref: arg("ref") });
  const panels = Number(arg("panels", 12));
  const schema = fs.readFileSync(path.join(import.meta.dirname, "schema.mjs"), "utf8");
  const sys = `You adapt difficult books into fun, character-driven cartoon scripts in the tradition of the illustrated science comic (loose art, dense in-panel text: narration boxes + speech bubbles + verbatim author quotes).
Output ONLY a JSON object matching this schema (comments are illustrative):
${schema.split("/**")[1].split("*/")[0]}
Rules: ${panels} panels; make it an entertaining STORY (characters, conflict, humour), not a lecture; every "quote" field MUST be an EXACT substring of the provided source (you may condense with "…" between exact fragments); give recurring characters an "anchor" prop for visual consistency; multi-character panels use distance composition.`;
  const msg = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 8000,
    system: sys,
    messages: [{ role: "user", content: `SOURCE (excerpt, verbatim):\n\n${source.slice(0, 60000)}` }],
  });
  const text = msg.content.map((c) => c.text || "").join("");
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(json);
}

async function main() {
  const out = arg("out");
  if (!out) { console.error("--out <file> required"); process.exit(2); }

  let script;
  if (arg("api")) {
    console.error("→ generating script via Anthropic (Opus)…");
    script = await generateWithApi();
  } else {
    const src = arg("script");
    if (!src) { console.error("--script <file> or --api required"); process.exit(2); }
    script = JSON.parse(fs.readFileSync(src, "utf8"));
  }

  // structural validation
  const st = validateStructure(script);
  if (!st.ok) {
    console.error("✗ STRUCTURE FAILED:");
    st.errors.forEach((e) => console.error("   - " + e));
    process.exit(1);
  }
  console.error("✓ structure ok");

  // GATE-1 against the real source
  console.error(`→ fetching source (${script.book.source}:${script.book.ref})…`);
  const source = await fetchSource(script.book);
  const g = gate1(script, source);

  console.error("\nGATE-1 report");
  console.error(`  panels: ${g.band.actual}/${g.band.declared} ${g.band.ok ? "✓" : "✗ mismatch"}`);
  console.error(`  verbatim quotes: ${g.quotes.filter((q) => q.ok).length}/${g.quotes.length} exact`);
  for (const q of g.quotes.filter((x) => !x.ok))
    console.error(`     ✗ panel ${q.panel} (${q.tier}): missing fragment "${q.missing[0]}"`);
  console.error(`  coverage: gaps=${g.coverage.gaps} overlaps=${g.coverage.overlaps} spanCovered=${g.coverage.spanCovered ? "yes" : "no"}`);
  if (g.missingTier.length) console.error(`  ✗ panels missing default tier: ${g.missingTier.join(",")}`);

  if (!g.ok) {
    console.error("\n✗ GATE-1 FAILED — fix quotes/tiers/panel count before proceeding.");
    if (!arg("force")) process.exit(1);
    console.error("  (--force given: writing anyway)");
  } else {
    console.error("\n✓ GATE-1 PASSED");
  }

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(script, null, 2));
  console.error(`→ wrote ${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
