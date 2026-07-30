// scripts/comic/evaluate.mjs
// Series-wide evaluation & remediation for the whole book (all chapters + panels).
// Checks the required elements — story/coverage, images, character consistency,
// cross-chapter continuity — against the character bible (cast.json), and writes a
// prioritised remediation list. This is the repeatable QC that keeps every chapter
// at the same bar.
//
//   node scripts/comic/evaluate.mjs                 # evaluate all chapters → series-report.md
//   node scripts/comic/evaluate.mjs --sync-cast     # rewrite every chapter's cast from the bible
//
// The image/story "does it look right" judgement is done by Claude (vision): this
// tool surfaces WHAT to look at and WHAT drifted; the QC loop (02b-verify) repairs it.

import fs from "fs";
import path from "path";
import { validateStructure } from "./schema.mjs";
import { gate2 } from "./lib.mjs";

const DIR = path.join(import.meta.dirname, "examples");
const BIBLE = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "cast.json"), "utf8"));
const IMG_BASE = "scratchpad-foreign/frank{n}/img";

function arg(name) { return process.argv.includes(`--${name}`); }
const stripHtml = (s) => String(s || "").replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, " ");
const words = (s) => stripHtml(s).trim().split(/\s+/).filter(Boolean).length;

// discover chapter scripts, sorted by chapter number
const files = fs.readdirSync(DIR).filter((f) => /frankenstein-ch\d+\.json$/.test(f))
  .map((f) => ({ f, n: Number(f.match(/ch(\d+)/)[1]) })).sort((a, b) => a.n - b.n);

// ---- sync casts from the bible (remediation for description drift) ----
if (arg("sync-cast")) {
  for (const { f } of files) {
    const p = path.join(DIR, f);
    const s = JSON.parse(fs.readFileSync(p, "utf8"));
    let changed = 0;
    for (const c of s.cast) {
      const b = BIBLE.characters[c.id];
      if (!b) continue;
      if (c.canonical !== b.canonical || c.anchor !== b.anchor || c.name !== b.name) {
        c.name = b.name; c.canonical = b.canonical; c.anchor = b.anchor; changed++;
      }
    }
    fs.writeFileSync(p, JSON.stringify(s, null, 2));
    console.error(`✎ ${f}: synced ${changed} cast entries from bible`);
  }
  process.exit(0);
}

// ---- evaluate ----
const appear = {};              // characterId -> [chapter numbers]
const lines = ["# Frankenstein — Series Evaluation", "", `Chapters: ${files.map((x) => x.n).join(", ")}`, ""];
let issues = [];

for (const { f, n } of files) {
  const s = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
  const st = validateStructure(s);
  // retention
  const tier = s.adaptation.default_tier;
  let tw = 0;
  for (const p of s.panels) {
    const t = (p.text && p.text[tier]) || {};
    tw += words(t.narration) + words(t.quote) + (t.bubbles || []).reduce((a, b) => a + words(b.text), 0)
      + (t.labels || []).reduce((a, l) => a + words(l.text), 0);
  }
  const orig = s.adaptation.original_words || s.book.total_words || 1;
  const ret = ((tw / orig) * 100).toFixed(1);
  // verbatim count (quotes + verbatim bubbles) — quality signal
  let vb = 0;
  for (const p of s.panels) { const t = (p.text && p.text[tier]) || {}; if (t.quote) vb++; for (const b of t.bubbles || []) if (b.verbatim) vb++; }
  // characters used
  const used = new Set();
  for (const p of s.panels) for (const id of p.characters || []) used.add(id);
  for (const id of used) (appear[id] = appear[id] || []).push(n);
  // cast vs bible drift
  const drift = [];
  for (const c of s.cast) {
    const b = BIBLE.characters[c.id];
    if (!b) { drift.push(`${c.id} (not in bible)`); continue; }
    if (c.canonical !== b.canonical || c.anchor !== b.anchor) drift.push(`${c.id} (desc ≠ bible)`);
  }
  // image QC (if images present)
  const imgDir = IMG_BASE.replace("{n}", n);
  let imgReport = "images: (not found)";
  if (fs.existsSync(imgDir)) {
    const bad = s.panels.filter((p) => !gate2(path.join(imgDir, `${String(p.n).padStart(2, "0")}.jpg`)).ok).map((p) => p.n);
    const sizes = s.panels.map((p) => { const g = gate2(path.join(imgDir, `${String(p.n).padStart(2, "0")}.jpg`)); return g.ok ? g.bytes : 0; }).filter(Boolean);
    const avg = sizes.length ? Math.round(sizes.reduce((a, b) => a + b) / sizes.length) : 0;
    imgReport = `images: ${s.panels.length - bad.length}/${s.panels.length} ok, avg ${avg}B${bad.length ? ", MISSING/blank: " + bad.join(",") : ""}`;
    if (bad.length) issues.push(`ch${n}: image QC fail panels ${bad.join(",")} → rerun 02-images`);
  }

  lines.push(`## Chapter ${n} — ${s.book.title}`);
  lines.push(`- structure: ${st.ok ? "ok" : "FAIL (" + st.errors.join("; ") + ")"}`);
  lines.push(`- panels: ${s.panels.length} · retention: ${ret}% · verbatim lines: ${vb}`);
  lines.push(`- ${imgReport}`);
  lines.push(`- characters: ${[...used].join(", ")}`);
  lines.push(`- cast vs bible: ${drift.length ? "⚠ DRIFT — " + drift.join("; ") : "in sync ✓"}`);
  lines.push("");
  if (!st.ok) issues.push(`ch${n}: structure invalid`);
  if (Number(ret) < 20) issues.push(`ch${n}: retention ${ret}% < 20% target`);
  if (drift.length) issues.push(`ch${n}: cast drift (${drift.join(", ")}) → run --sync-cast + regen those panels`);
}

// ---- cross-chapter continuity ----
lines.push("## Cross-chapter continuity");
lines.push("| character | bible signature | appears in |");
lines.push("|---|---|---|");
for (const [id, b] of Object.entries(BIBLE.characters)) {
  const chs = (appear[id] || []).sort((a, b) => a - b);
  const declared = (b.appears_in || []).slice().sort((a, b) => a - b);
  const mismatch = JSON.stringify(chs) !== JSON.stringify(declared);
  lines.push(`| ${b.name} | ${b.signature} | used:${chs.join(",") || "—"} / bible:${declared.join(",")} ${mismatch ? "⚠" : "✓"} |`);
  if (mismatch) issues.push(`${id}: appears_in bible(${declared.join(",")}) ≠ used(${chs.join(",")})`);
}
// characters used but absent from bible
const inScripts = new Set(Object.keys(appear));
for (const id of inScripts) if (!BIBLE.characters[id]) issues.push(`${id}: used in scripts but missing from bible`);

lines.push("", "## Remediation queue (priority order)");
if (!issues.length) lines.push("- none — series is consistent ✓");
else issues.forEach((x, i) => lines.push(`${i + 1}. ${x}`));

const out = path.join(import.meta.dirname, "series-report.md");
fs.writeFileSync(out, lines.join("\n"));
console.error(lines.join("\n"));
console.error(`\n→ wrote ${out}`);
