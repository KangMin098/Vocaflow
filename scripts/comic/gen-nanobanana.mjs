// scripts/comic/gen-nanobanana.mjs
// Nano Banana (Google Gemini image) backend adapter — an alternative to the free
// Pollinations FLUX in 02-images.mjs. Two-stage character-consistency workflow:
//   1) build ONE flat-ink reference image per bible character (text->image), cached
//      in <outDir>/refs/<charId>.jpg  (the "character sheet")
//   2) generate each panel by sending its prompt + the reference images of the
//      characters in that panel, so Gemini locks BOTH the character identity and the
//      flat-ink style across every panel (its purpose-built strength).
//
// Auth: put your key in scripts/comic/.gemini-token (gitignored) or env GEMINI_API_KEY.
// Get a free key at https://aistudio.google.com/apikey
//
// Usage:
//   node scripts/comic/gen-nanobanana.mjs --script <script.json> --out <dir> [--panels 2,14,15] [--refs-only] [--model gemini-2.5-flash-image]
//
// Text is NEVER baked into the art (we letter in HTML), so prompts ask for a clean
// text-free panel — this avoids the garbled-bubble problem entirely.

import fs from "fs";
import path from "path";
import { buildImagePrompt, STYLES, styleFor } from "./lib.mjs";

const HERE = import.meta.dirname;
function arg(name, def) { const i = process.argv.indexOf(`--${name}`); if (i === -1) return def; const v = process.argv[i + 1]; return v && !v.startsWith("--") ? v : true; }
const has = (name) => process.argv.includes(`--${name}`);

const scriptPath = arg("script");
const outDir = arg("out");
if (!scriptPath || !outDir) { console.error("--script and --out required"); process.exit(2); }
const MODEL = arg("model", "gemini-2.5-flash-image");
const onlyPanels = arg("panels") ? String(arg("panels")).split(",").map(Number) : null;

const tokenFile = path.join(HERE, ".gemini-token");
const KEY = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  || (fs.existsSync(tokenFile) ? fs.readFileSync(tokenFile, "utf8") : "")).trim();
if (!KEY) { console.error("No Gemini key. Put it in scripts/comic/.gemini-token or env GEMINI_API_KEY. Get one free: https://aistudio.google.com/apikey"); process.exit(3); }

const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
const cast = script.cast || [];
const style = styleFor(script.adaptation.target_v_level, script.adaptation.art_maturity) || STYLES.teen;
const refsDir = path.join(outDir, "refs");
fs.mkdirSync(refsDir, { recursive: true });
const API = (m) => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(KEY)}`;

const b64 = (p) => fs.readFileSync(p).toString("base64");
const imgPart = (p) => ({ inline_data: { mime_type: "image/jpeg", data: b64(p) } });

// call Gemini image generation; parts = [{text},{inline_data}...]; returns jpeg buffer
async function genImage(parts, tries = 3) {
  const body = { contents: [{ parts }], generationConfig: { responseModalities: ["IMAGE"] } };
  let lastErr = "";
  for (let a = 0; a < tries; a++) {
    try {
      const r = await fetch(API(MODEL), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) });
      const j = await r.json();
      if (!r.ok) { lastErr = JSON.stringify(j).slice(0, 300); if (r.status === 429) { await new Promise((z) => setTimeout(z, 6000)); continue; } throw new Error(lastErr); }
      const out = (j.candidates?.[0]?.content?.parts || []).find((p) => p.inline_data || p.inlineData);
      const data = out?.inline_data?.data || out?.inlineData?.data;
      if (data) return Buffer.from(data, "base64");
      lastErr = "no image part in response: " + JSON.stringify(j).slice(0, 300);
    } catch (e) { lastErr = e.message; }
    await new Promise((z) => setTimeout(z, 2500));
  }
  throw new Error(lastErr || "gen failed");
}

// 1) build a flat-ink reference sheet for one character (text->image, no refs)
async function buildRef(c) {
  const out = path.join(refsDir, `${c.id}.jpg`);
  if (fs.existsSync(out) && !has("refs-force")) { console.error(`· ref ${c.id} exists`); return out; }
  const prompt = `${style}. A clean model sheet: a SINGLE full-body character on a plain white background, no text, no words, no other figures. ${c.name}: ${c.canonical}, ${c.anchor}. Flat black-and-white hand-inked cartoon, bold outlines, consistent iconic design.`;
  const buf = await genImage([{ text: prompt }]);
  fs.writeFileSync(out, buf);
  console.error(`✓ ref ${c.id}  ${buf.length}B`);
  return out;
}

// 2) generate one panel using the references of its characters
async function genPanel(p) {
  const outPath = path.join(outDir, `${String(p.n).padStart(2, "0")}.jpg`);
  const ids = p.characters || [];
  const refParts = ids.map((id) => path.join(refsDir, `${id}.jpg`)).filter(fs.existsSync).map(imgPart);
  const prompt = `${buildImagePrompt(p, cast, style)} IMPORTANT: keep each character IDENTICAL to the provided reference image(s) of that character. A clean comic panel with NO text, NO words, NO speech bubbles, NO lettering anywhere.`;
  const parts = [{ text: prompt }, ...refParts];
  const buf = await genImage(parts);
  fs.writeFileSync(outPath, buf);
  console.error(`✓ panel ${p.n}  ${buf.length}B  (refs: ${ids.join(",") || "none"})`);
}

// ---- run ----
console.error(`→ Nano Banana (${MODEL}); refs for: ${cast.map((c) => c.id).join(", ")}`);
for (const c of cast) { try { await buildRef(c); } catch (e) { console.error(`✗ ref ${c.id}: ${e.message}`); } }
if (has("refs-only")) { console.error("refs-only done"); process.exit(0); }
let ok = 0, fail = 0;
for (const p of [...script.panels].sort((a, b) => a.n - b.n)) {
  if (onlyPanels && !onlyPanels.includes(p.n)) continue;
  try { await genPanel(p); ok++; } catch (e) { console.error(`✗ panel ${p.n}: ${e.message}`); fail++; }
}
console.error(`\ndone — ${ok} panels, ${fail} failed`);
