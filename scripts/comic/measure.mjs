// scripts/comic/measure.mjs
// Compare the amount of text in the ORIGINAL book vs the COMIC SCRIPT.
// Usage: node scripts/comic/measure.mjs <script.json> [tier]
import fs from "fs";
import { fetchSource } from "./lib.mjs";

const stripHtml = (s) => String(s || "")
  .replace(/<[^>]+>/g, "")
  .replace(/&mdash;|&rarr;/g, " ")
  .replace(/&rsquo;|&lsquo;/g, "'")
  .replace(/&ldquo;|&rdquo;/g, '"')
  .replace(/&[a-z]+;/g, " ");
const words = (s) => stripHtml(s).trim().split(/\s+/).filter(Boolean).length;

const scriptPath = process.argv[2];
const s = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
const tier = process.argv[3] || s.adaptation.default_tier;

let origWords, origLabel;
if (Number.isInteger(s.adaptation.original_words)) {
  // adaptation declares the exact size of the unit it adapts (e.g. one chapter)
  origWords = s.adaptation.original_words;
  origLabel = "ORIGINAL unit (declared):   ";
} else {
  const src = await fetchSource(s.book);
  // crude word count of the gutenberg body (strip PG header/footer boilerplate)
  let body = src;
  const start = body.indexOf("*** START");
  const end = body.indexOf("*** END");
  if (start > -1 && end > start) body = body.slice(body.indexOf("\n", start), end);
  origWords = body.trim().split(/\s+/).filter(Boolean).length;
  origLabel = "ORIGINAL book (full):        ";
}

let nar = 0, bub = 0, quo = 0, lab = 0;
const rows = [];
for (const p of s.panels) {
  const t = (p.text && (p.text[tier] || p.text[s.adaptation.default_tier])) || {};
  const n = words(t.narration);
  const b = (t.bubbles || []).reduce((a, x) => a + words(x.text), 0);
  const q = words(t.quote);
  const l = (t.labels || []).reduce((a, x) => a + words(x.text), 0);
  nar += n; bub += b; quo += q; lab += l;
  rows.push({ n: p.n, nar: n, bub: b, quo: q, lab: l, tot: n + b + q + l });
}
const comicWords = nar + bub + quo + lab;

const pct = (x) => ((x / comicWords) * 100).toFixed(0) + "%";
console.log(`\nBOOK: ${s.book.title}`);
console.log(`tier: ${tier}   panels: ${s.panels.length}`);
console.log("─".repeat(52));
console.log(`${origLabel}${origWords.toLocaleString()} words`);
console.log(`COMIC script (all in-panel): ${comicWords.toLocaleString()} words`);
console.log(`compression:                 ${(origWords / comicWords).toFixed(0)}:1  (comic = ${(comicWords / origWords * 100).toFixed(1)}% of original)`);
console.log("─".repeat(52));
console.log("comic breakdown:");
console.log(`  narration (adapted):   ${String(nar).padStart(4)}  ${pct(nar)}`);
console.log(`  bubbles   (adapted):   ${String(bub).padStart(4)}  ${pct(bub)}`);
console.log(`  quotes    (VERBATIM):  ${String(quo).padStart(4)}  ${pct(quo)}`);
console.log(`  labels    (adapted):   ${String(lab).padStart(4)}  ${pct(lab)}`);
console.log(`  verbatim-original share of comic: ${pct(quo)}`);
console.log("─".repeat(52));
console.log("per-panel words (nar/bub/quo/lab = total):");
for (const r of rows)
  console.log(`  P${String(r.n).padStart(2)}: ${String(r.nar).padStart(3)}/${String(r.bub).padStart(2)}/${String(r.quo).padStart(3)}/${String(r.lab).padStart(2)} = ${r.tot}`);
console.log(`  avg per panel: ${Math.round(comicWords / s.panels.length)} words`);
