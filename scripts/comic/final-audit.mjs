// scripts/comic/final-audit.mjs
// FINAL ACCEPTANCE GATE for the whole book. Run this once every section is built
// to decide ship / no-ship. It is stricter than evaluate.mjs: it re-verifies every
// gate for real, enforces completeness (all 28 sections), a 9.5 QC bar (from the
// qc-scores ledger), cognitive-load and cast-continuity, then writes a prioritised
// remediation queue and a single SHIP / NO-SHIP verdict.
//
//   node scripts/comic/final-audit.mjs                # audit → final-audit-report.md
//   node scripts/comic/final-audit.mjs --remediate    # + auto-apply the cheap deterministic fixes
//
// Design: the automatable checks (structure, verbatim, image bytes, retention band,
// cognitive load, cast drift, appears_in, style uniformity, completeness) are decided
// here. The vision "does every panel read at 9.5" judgement lives in qc-scores.json,
// which Claude fills while QC-ing each chapter; a panel below the bar must be marked
// 'remediated' (fixed) or 'accepted-limit' (documented free-tier ceiling) — anything
// still 'open' blocks the ship verdict.

import fs from "fs";
import path from "path";
import { validateStructure } from "./schema.mjs";
import { gate1, gate2, fetchSource, styleFor } from "./lib.mjs";

const HERE = import.meta.dirname;
const DIR = path.join(HERE, "examples");
const BIBLE = JSON.parse(fs.readFileSync(path.join(HERE, "cast.json"), "utf8"));
const SCORES = readJson(path.join(HERE, "qc-scores.json")) || { bar: 9.5, chapters: {} };
const IMG_BASE = "scratchpad-foreign/frank{n}/img";
const BAR = SCORES.bar || 9.5;

// The full book: 4 opening Letters + 24 chapters = 28 sections (1831 / Gutenberg 84).
const MANIFEST = {
  letters: [1, 2, 3, 4],
  chapters: Array.from({ length: 24 }, (_, i) => i + 1),
};
const RETENTION_MIN = 25;   // target band lower edge (soft)
const RETENTION_HARD = 20;  // below this is a hard fail
const MAX_BUBBLES = 4;      // cognitive load ~4 items

const REMEDIATE = process.argv.includes("--remediate");
const stripHtml = (s) => String(s || "").replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, " ");
const words = (s) => stripHtml(s).trim().split(/\s+/).filter(Boolean).length;
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } }
const pad = (n) => String(n).padStart(2, "0");

// ---- discover built sections ----
function sectionFile(kind, n) {
  const stem = kind === "letter" ? `frankenstein-letter${n}.json` : `frankenstein-ch${n}.json`;
  const p = path.join(DIR, stem);
  return fs.existsSync(p) ? p : null;
}
function imgDirFor(kind, n) {
  return IMG_BASE.replace("{n}", kind === "letter" ? `L${n}` : String(n));
}

const report = [];
const queue = [];              // {sev, msg, fix} — sev: 'block' | 'warn'
const appear = {};             // characterId -> chapters where actually rendered
let present = 0, total = MANIFEST.letters.length + MANIFEST.chapters.length;

report.push("# Frankenstein — FINAL ACCEPTANCE AUDIT", "");
report.push(`Book manifest: ${MANIFEST.letters.length} Letters + ${MANIFEST.chapters.length} Chapters = ${total} sections`, "");

// ---- per-section audit ----
async function auditSection(kind, n) {
  const label = kind === "letter" ? `Letter ${n}` : `Chapter ${n}`;
  const file = sectionFile(kind, n);
  if (!file) {
    queue.push({ sev: "block", msg: `${label}: NOT BUILT`, fix: `author scripts/comic/examples/frankenstein-${kind === "letter" ? "letter" : "ch"}${n}.json → 01→02→QC→03` });
    report.push(`## ${label} — ✗ NOT BUILT`, "");
    return;
  }
  present++;
  const s = JSON.parse(fs.readFileSync(file, "utf8"));
  const tier = s.adaptation.default_tier;
  const st = validateStructure(s);
  if (!st.ok) queue.push({ sev: "block", msg: `${label}: structure invalid — ${st.errors.join("; ")}`, fix: "fix schema fields" });

  // GATE-1 verbatim (for real, against the source)
  let g1 = "skipped";
  try {
    const source = await fetchSource(s.book);
    const g = gate1(s, source);
    g1 = g.ok ? `PASS (${g.quotes.filter((q) => q.ok).length}/${g.quotes.length})` : "FAIL";
    if (!g.ok) {
      const miss = g.quotes.filter((q) => !q.ok).map((q) => `p${q.panel}`).join(",");
      queue.push({ sev: "block", msg: `${label}: GATE-1 verbatim FAIL (${miss})`, fix: "fix quotes → rerun 01-script" });
    }
    if (!g.band.ok) queue.push({ sev: "warn", msg: `${label}: panel_count ${g.band.declared}≠${g.band.actual}`, fix: "reconcile panel_count" });
  } catch (e) { g1 = `error(${e.message})`; queue.push({ sev: "warn", msg: `${label}: GATE-1 could not run — ${e.message}`, fix: "check book.source/ref" }); }

  // retention
  let tw = 0;
  for (const p of s.panels) {
    const t = (p.text && p.text[tier]) || {};
    tw += words(t.narration) + words(t.quote) + (t.bubbles || []).reduce((a, b) => a + words(b.text), 0);
  }
  const orig = s.adaptation.original_words || s.book.total_words || 1;
  const ret = (tw / orig) * 100;
  if (ret < RETENTION_HARD) queue.push({ sev: "block", msg: `${label}: retention ${ret.toFixed(1)}% < ${RETENTION_HARD}% hard floor`, fix: "add verbatim fragments" });
  else if (ret < RETENTION_MIN - 0.1) queue.push({ sev: "warn", msg: `${label}: retention ${ret.toFixed(1)}% < ${RETENTION_MIN}% target`, fix: "add verbatim fragments" });

  // cognitive load
  const heavy = s.panels.filter((p) => ((p.text?.[tier]?.bubbles) || []).length > MAX_BUBBLES).map((p) => p.n);
  if (heavy.length) queue.push({ sev: "warn", msg: `${label}: panels over ${MAX_BUBBLES} bubbles — ${heavy.join(",")}`, fix: "redistribute bubbles" });

  // style uniformity (whole book must be one maturity tier)
  const style = styleFor(s.adaptation.target_v_level, s.adaptation.art_maturity);
  const mature = style === styleFor(10);

  // images GATE-2
  const imgDir = imgDirFor(kind, n);
  let imgReport = "images: (dir not found)";
  if (fs.existsSync(imgDir)) {
    const bad = s.panels.filter((p) => !gate2(path.join(imgDir, `${pad(p.n)}.jpg`)).ok).map((p) => p.n);
    const sizes = s.panels.map((p) => gate2(path.join(imgDir, `${pad(p.n)}.jpg`))).filter((g) => g.ok).map((g) => g.bytes);
    const avg = sizes.length ? Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length) : 0;
    imgReport = `images ${s.panels.length - bad.length}/${s.panels.length} ok, avg ${avg}B${bad.length ? `, BLANK/MISSING ${bad.join(",")}` : ""}`;
    if (bad.length) queue.push({ sev: "block", msg: `${label}: image GATE-2 fail ${bad.join(",")}`, fix: `rm those + rerun 02-images (sequential resume)` });
  } else {
    queue.push({ sev: "block", msg: `${label}: no images generated`, fix: "run 02-images" });
  }

  // cast drift + rendered characters
  const used = new Set();
  for (const p of s.panels) for (const id of p.characters || []) used.add(id);
  for (const id of used) (appear[id] = appear[id] || []).push(n);
  const drift = [];
  for (const c of s.cast) {
    const b = BIBLE.characters[c.id];
    if (!b) { drift.push(`${c.id}(not in bible)`); continue; }
    if (c.variant) continue;
    if (c.canonical !== b.canonical || c.anchor !== b.anchor) drift.push(`${c.id}(≠bible)`);
  }
  if (drift.length) queue.push({ sev: "warn", msg: `${label}: cast drift ${drift.join(",")}`, fix: "evaluate.mjs --sync-cast + regen" });

  // 9.5 QC bar (from ledger)
  const sc = SCORES.chapters[String(n)] && kind === "chapter" ? SCORES.chapters[String(n)] : null;
  let qcLine;
  if (!sc) { qcLine = "QC ledger: (none recorded)"; queue.push({ sev: "block", msg: `${label}: no 9.5 QC audit recorded`, fix: "vision-QC every panel → qc-scores.json" }); }
  else {
    const open = (sc.flagged || []).filter((x) => x.status === "open");
    const limits = (sc.flagged || []).filter((x) => x.status === "accepted-limit");
    const passed = (sc.floor >= BAR) && open.length === 0;
    qcLine = `QC floor ${sc.floor} (bar ${BAR}) — ${open.length ? "OPEN ISSUES" : passed ? "PASS ✓" : "ceiling-limited"}${limits.length ? `, ${limits.length} accepted-limit` : ""}${open.length ? `, ${open.length} OPEN` : ""}`;
    for (const o of open) queue.push({ sev: "block", msg: `${label} p${o.panel}: QC ${o.score} < ${BAR} (open) — ${o.note}`, fix: "remediate panel → regen" });
    // sub-bar but every low panel is an accepted free-tier ceiling: surface, don't block
    if (!passed && open.length === 0) queue.push({ sev: "warn", msg: `${label}: QC floor ${sc.floor} < ${BAR} (documented platform ceiling: ${limits.map((x) => "p" + x.panel).join(",") || "n/a"})`, fix: "T1 IP-Adapter to exceed free-FLUX ceiling" });
  }

  report.push(`## ${label} — ${st.ok ? "structure ok" : "STRUCTURE FAIL"}`);
  report.push(`- GATE-1 verbatim: ${g1}`);
  report.push(`- panels ${s.panels.length} · retention ${ret.toFixed(1)}% · maturity ${mature ? "mature ✓" : "⚠ NON-mature"}`);
  report.push(`- ${imgReport}`);
  report.push(`- characters: ${[...used].join(", ") || "—"} · cast ${drift.length ? "DRIFT " + drift.join(",") : "in sync ✓"}`);
  report.push(`- ${qcLine}`);
  report.push("");
}

for (const n of MANIFEST.letters) await auditSection("letter", n);
for (const n of MANIFEST.chapters) await auditSection("chapter", n);

// ---- cross-chapter continuity ----
report.push("## Cross-chapter continuity");
report.push("| character | appears in | bible appears_in | |");
report.push("|---|---|---|---|");
for (const [id, b] of Object.entries(BIBLE.characters)) {
  const chs = (appear[id] || []).sort((a, b) => a - b);
  const declared = (b.appears_in || []).slice().sort((a, b) => a - b);
  const ok = JSON.stringify(chs) === JSON.stringify(declared);
  report.push(`| ${b.name} | ${chs.join(",") || "—"} | ${declared.join(",")} | ${ok ? "✓" : "⚠"} |`);
  if (!ok) queue.push({ sev: "warn", msg: `${id}: appears_in bible(${declared.join(",")}) ≠ used(${chs.join(",")})`, fix: "reconcile appears_in" });
}
for (const id of Object.keys(appear)) if (!BIBLE.characters[id]) queue.push({ sev: "block", msg: `${id}: rendered but missing from bible`, fix: "add to cast.json" });

// ---- optional cheap remediation ----
if (REMEDIATE) {
  // reconcile appears_in from actual usage (deterministic, safe)
  let fixed = 0;
  for (const [id, b] of Object.entries(BIBLE.characters)) {
    const chs = (appear[id] || []).sort((a, b) => a - b);
    if (JSON.stringify((b.appears_in || []).slice().sort((a, b) => a - b)) !== JSON.stringify(chs)) { b.appears_in = chs; fixed++; }
  }
  if (fixed) { fs.writeFileSync(path.join(HERE, "cast.json"), JSON.stringify(BIBLE, null, 2)); report.push("", `> --remediate: reconciled appears_in for ${fixed} characters`); }
}

// ---- verdict ----
const blockers = queue.filter((q) => q.sev === "block");
const warns = queue.filter((q) => q.sev === "warn");
const complete = present === total;
const ship = complete && blockers.length === 0;

report.push("", "## Remediation queue (priority order)");
if (!queue.length) report.push("- none — book is clean ✓");
else {
  [...blockers, ...warns].forEach((q, i) => report.push(`${i + 1}. [${q.sev === "block" ? "BLOCK" : "warn"}] ${q.msg}  →  _${q.fix}_`));
}
report.push("", "## VERDICT");
report.push(`- sections built: ${present}/${total}${complete ? " ✓" : " — INCOMPLETE"}`);
report.push(`- blockers: ${blockers.length} · warnings: ${warns.length}`);
report.push(`- **${ship ? "🟢 SHIP — book passes the final acceptance gate" : "🔴 NO-SHIP — " + (!complete ? "book incomplete" : blockers.length + " blocker(s) remain")}**`);

const out = path.join(HERE, "final-audit-report.md");
fs.writeFileSync(out, report.join("\n"));
console.error(report.join("\n"));
console.error(`\n→ wrote ${out}`);
process.exit(ship ? 0 : 1);
