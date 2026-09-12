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

const HERE = import.meta.dirname;
function arg(name, def) { const i = process.argv.indexOf(`--${name}`); if (i === -1) return def; const v = process.argv[i + 1]; return v && !v.startsWith("--") ? v : true; }
const has = (name) => process.argv.includes(`--${name}`);

const scriptPath = arg("script");
const outDir = arg("out");
if (!scriptPath || !outDir) { console.error("--script and --out required"); process.exit(2); }
// DEFAULT = Nano Banana PRO. gemini-2.5-flash-image is officially "not optimized for
// multiple reference inputs or multi-turn sequential editing" (ai.google.dev image
// docs) → it is the WRONG model for a consistent recurring cast. Pro (gemini-3-pro-image)
// locks up to 5 character refs + 6 object + 3 style refs. Override with --model.
const MODEL = arg("model", "gemini-3-pro-image");
const onlyPanels = arg("panels") ? String(arg("panels")).split(",").map(Number) : null;

const tokenFile = path.join(HERE, ".gemini-token");
const KEY = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  || (fs.existsSync(tokenFile) ? fs.readFileSync(tokenFile, "utf8") : "")).trim();
if (!KEY) { console.error("No Gemini key. Put it in scripts/comic/.gemini-token or env GEMINI_API_KEY. Get one free: https://aistudio.google.com/apikey"); process.exit(3); }

const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
const cast = script.cast || [];
const refsDir = path.join(outDir, "refs");
fs.mkdirSync(refsDir, { recursive: true });
const API = (m) => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(KEY)}`;

const b64 = (p) => fs.readFileSync(p).toString("base64");
const imgPart = (p) => ({ inline_data: { mime_type: "image/jpeg", data: b64(p) } });

// call Gemini image generation; parts = [{text},{inline_data}...]; returns jpeg buffer.
// aspect: one of Gemini's supported ratios (1:1 2:3 3:2 3:4 4:3 4:5 5:4 9:16 16:9 21:9).
// NOTE: NO seed param — Gemini image models are autoregressive, not diffusion, so there
// is no seed/reproducibility control; consistency comes from reference images + prompt.
// When multiple refs of different ratios are sent the output adopts the LAST image's
// ratio, so we ALWAYS pin aspectRatio explicitly here to override that.
async function genImage(parts, aspect = "3:4", tries = 3) {
  const body = { contents: [{ parts }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: aspect } } };
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

const byId = Object.fromEntries(cast.map((c) => [c.id, c]));
// The flat-ink "ligne claire" style clause (the documented Gonick/educational look on
// Gemini): equal-width continuous ink lines, flat, NO gradients/shading. Nano Banana —
// unlike FLUX — DOES honour plain negatives, so we state them directly. We deliberately
// avoid the words "comic panel / speech balloon / caption": Pro is the best text-in-image
// model and those words make it draw lettering. We letter in HTML, so we ask for a clean
// text-free single illustration.
const INK = "Ligne-claire flat black-and-white hand-inked cartoon in the style of a Larry Gonick educational history comic: precise continuous EQUAL-WIDTH black ink outlines, simple high-contrast flat shapes, light hatching only, caricatured expressive faces, strictly black and white, no gradients, no soft shading, no photorealism, no 3D render, plain white background.";
const NOTEXT = "Output a single clean illustration with NO text, NO words, NO letters, NO speech bubbles, NO caption boxes, NO panel borders anywhere in the image.";

// 1) build a flat-ink reference sheet for one character (text->image, no refs)
async function buildRef(c) {
  const out = path.join(refsDir, `${c.id}.jpg`);
  if (fs.existsSync(out) && !has("refs-force")) { console.error(`· ref ${c.id} exists`); return out; }
  const prompt = `${INK} A character model sheet of ONE single figure on a plain white background — the SAME person shown front view, 3/4 view, and side view, plus three facial expressions. ${c.name}: ${c.canonical}, ${c.anchor}. Keep the design simple and iconic with the exact same signature features in every view. ${NOTEXT}`;
  const buf = await genImage([{ text: prompt }], "4:3");
  fs.writeFileSync(out, buf);
  console.error(`✓ ref ${c.id}  ${buf.length}B`);
  return out;
}

// 2) generate one panel using the references of its characters.
// Reference images are ROLE-LABELLED in the prompt ("Reference 1 shows X — keep X
// identical"), which the docs say is what makes multi-ref identity locking work; a bare
// unlabelled image is treated as vague "inspiration".
async function genPanel(p) {
  const outPath = path.join(outDir, `${String(p.n).padStart(2, "0")}.jpg`);
  const ids = (p.characters || []).filter((id) => fs.existsSync(path.join(refsDir, `${id}.jpg`)));
  const chars = ids.map((id) => byId[id]).filter(Boolean);
  const refLines = chars.map((c, i) => `Reference image ${i + 1} is the character sheet for ${c.name.toUpperCase()} — keep ${c.name} EXACTLY identical to it (same face, hair, build, costume).`);
  const roster = chars.map((c) => `${c.name.toUpperCase()} (${c.canonical}, ${c.anchor})`).join("; ");
  let placement = "";
  if (chars.length === 2) placement = ` Place ${chars[0].name} on the left and ${chars[1].name} on the right, clearly apart.`;
  else if (chars.length >= 3) placement = " Show each character as a distinct full figure, spread apart.";
  const prompt = [
    INK,
    refLines.join(" "),
    roster ? `Characters in this scene: ${roster}.` : "",
    `Scene: ${p.scene}.`,
    `Composition: ${p.composition}.${placement}`,
    "Fill the frame with the scene, the main subject prominent and fully inside the edges, not cropped.",
    NOTEXT,
  ].filter(Boolean).join(" ");
  const refParts = ids.map((id) => imgPart(path.join(refsDir, `${id}.jpg`)));
  const buf = await genImage([{ text: prompt }, ...refParts], p.wide ? "16:9" : "3:4");
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
