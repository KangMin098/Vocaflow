// scripts/comic/gen-openai.mjs
// OpenAI image backend adapter (gpt-image-1 / gpt-image-2) — alternative to Pollinations
// FLUX and Nano Banana. Same two-stage consistency workflow:
//   1) build ONE flat-ink reference image per bible character (images/generations),
//      cached in <outDir>/refs/<charId>.png  (the "character sheet")
//   2) generate each panel via images/EDITS, passing the reference image(s) of the
//      characters in that panel + input_fidelity:"high" so gpt-image keeps the same
//      face/design. OpenAI has NO dedicated character-slots (weaker than Nano Banana),
//      so we lean on reference-edit + high input fidelity + a fixed style reference.
//
// Auth: scripts/comic/.openai-token (gitignored) or env OPENAI_API_KEY. Needs a paid
// account with billing (no free image tier). Get a key: https://platform.openai.com/api-keys
//
// Usage:
//   node scripts/comic/gen-openai.mjs --script <script.json> --out <dir> [--panels 2,14] [--refs-only] [--model gpt-image-1] [--size 1024x1024]
//
// Text is never baked in (we letter in HTML) → no garbled bubbles.

import fs from "fs";
import path from "path";
import { buildImagePrompt, STYLES, styleFor } from "./lib.mjs";

const HERE = import.meta.dirname;
function arg(name, def) { const i = process.argv.indexOf(`--${name}`); if (i === -1) return def; const v = process.argv[i + 1]; return v && !v.startsWith("--") ? v : true; }
const has = (name) => process.argv.includes(`--${name}`);

const scriptPath = arg("script"); const outDir = arg("out");
if (!scriptPath || !outDir) { console.error("--script and --out required"); process.exit(2); }
const MODEL = arg("model", "gpt-image-1");
const SIZE = arg("size", "1024x1024");
const onlyPanels = arg("panels") ? String(arg("panels")).split(",").map(Number) : null;

const tokenFile = path.join(HERE, ".openai-token");
const KEY = (process.env.OPENAI_API_KEY || (fs.existsSync(tokenFile) ? fs.readFileSync(tokenFile, "utf8") : "")).trim();
if (!KEY) { console.error("No OpenAI key. Put it in scripts/comic/.openai-token or env OPENAI_API_KEY (needs billing). https://platform.openai.com/api-keys"); process.exit(3); }

const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
const cast = script.cast || [];
const style = styleFor(script.adaptation.target_v_level, script.adaptation.art_maturity) || STYLES.teen;
const refsDir = path.join(outDir, "refs");
fs.mkdirSync(refsDir, { recursive: true });
const AUTH = { Authorization: `Bearer ${KEY}` };

async function post(url, body, headers = {}, tries = 3) {
  let lastErr = "";
  for (let a = 0; a < tries; a++) {
    try {
      const r = await fetch(url, { method: "POST", headers: { ...AUTH, ...headers }, body, signal: AbortSignal.timeout(180000) });
      const j = await r.json();
      if (!r.ok) { lastErr = JSON.stringify(j.error || j).slice(0, 300); if (r.status === 429) { await new Promise((z) => setTimeout(z, 7000)); continue; } throw new Error(lastErr); }
      return j;
    } catch (e) { lastErr = e.message; }
    await new Promise((z) => setTimeout(z, 2500));
  }
  throw new Error(lastErr || "request failed");
}
const firstB64 = (j) => j?.data?.[0]?.b64_json;

// 1) reference sheet via images/generations (text -> image)
async function buildRef(c) {
  const out = path.join(refsDir, `${c.id}.png`);
  if (fs.existsSync(out) && !has("refs-force")) { console.error(`· ref ${c.id} exists`); return out; }
  const prompt = `${style}. A clean model sheet: a SINGLE full-body character on a plain white background, no text, no words, no other figures. ${c.name}: ${c.canonical}, ${c.anchor}. Flat black-and-white hand-inked cartoon, bold outlines, consistent iconic design.`;
  const j = await post("https://api.openai.com/v1/images/generations",
    JSON.stringify({ model: MODEL, prompt, size: SIZE, n: 1 }), { "Content-Type": "application/json" });
  const b = firstB64(j); if (!b) throw new Error("no image");
  fs.writeFileSync(out, Buffer.from(b, "base64"));
  console.error(`✓ ref ${c.id}`);
  return out;
}

// 2) panel via images/edits (reference character images + prompt + high input fidelity)
async function genPanel(p) {
  const outPath = path.join(outDir, `${String(p.n).padStart(2, "0")}.jpg`);
  const ids = (p.characters || []).filter((id) => fs.existsSync(path.join(refsDir, `${id}.png`)));
  const prompt = `${buildImagePrompt(p, cast, style)} Keep each character IDENTICAL to the provided reference image(s). A clean comic panel with NO text, NO words, NO speech bubbles anywhere.`;
  let j;
  if (ids.length) {
    const fd = new FormData();
    fd.append("model", MODEL);
    fd.append("prompt", prompt);
    fd.append("size", SIZE);
    fd.append("input_fidelity", "high");
    for (const id of ids) {
      const buf = fs.readFileSync(path.join(refsDir, `${id}.png`));
      fd.append("image[]", new Blob([buf], { type: "image/png" }), `${id}.png`);
    }
    j = await post("https://api.openai.com/v1/images/edits", fd);
  } else {
    j = await post("https://api.openai.com/v1/images/generations",
      JSON.stringify({ model: MODEL, prompt, size: SIZE, n: 1 }), { "Content-Type": "application/json" });
  }
  const b = firstB64(j); if (!b) throw new Error("no image");
  fs.writeFileSync(outPath, Buffer.from(b, "base64"));
  console.error(`✓ panel ${p.n}  (refs: ${ids.join(",") || "none"})`);
}

console.error(`→ OpenAI (${MODEL}, ${SIZE}); refs for: ${cast.map((c) => c.id).join(", ")}`);
for (const c of cast) { try { await buildRef(c); } catch (e) { console.error(`✗ ref ${c.id}: ${e.message}`); } }
if (has("refs-only")) { console.error("refs-only done"); process.exit(0); }
let ok = 0, fail = 0;
for (const p of [...script.panels].sort((a, b) => a.n - b.n)) {
  if (onlyPanels && !onlyPanels.includes(p.n)) continue;
  try { await genPanel(p); ok++; } catch (e) { console.error(`✗ panel ${p.n}: ${e.message}`); fail++; }
}
console.error(`\ndone — ${ok} panels, ${fail} failed`);
