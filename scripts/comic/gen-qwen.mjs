// scripts/comic/gen-qwen.mjs
// Qwen-Image-Edit (Alibaba DashScope) backend adapter — the FREE character-locking path.
// New Model Studio (International/Singapore) users get 100 free images / 90 days with NO
// credit card, and qwen-image-edit preserves a character's identity from reference images
// (person+scene, facial-ID), so it is our best zero-cost alternative to paid Nano Banana.
//
// Two-stage, same as gen-nanobanana.mjs:
//   1) buildRef(c): TEXT->IMAGE model sheet per bible character -> refs/<id>.jpg
//      (model: qwen-image-max — text-to-image)
//   2) genPanel(p): IMAGE-EDIT — send the panel characters' reference sheets + a scene
//      instruction; the model keeps each character identical (model: qwen-image-edit-max).
//
// Auth: scripts/comic/.dashscope-token (gitignored) or env DASHSCOPE_API_KEY.
//   - Sign up (no card): https://www.alibabacloud.com/help/en/model-studio/  (Intl/Singapore)
//   - The key MUST be an International-edition (ap-southeast-1) key for the free quota.
// Endpoint override: env DASHSCOPE_ENDPOINT or --endpoint <url>.
// Model override: --gen-model / --edit-model.
//
// Text is never baked in (we letter in HTML) -> we ask for a clean text-free illustration
// and also pass a negative_prompt (Qwen honours negatives, unlike FLUX).
//
// Usage:
//   node scripts/comic/gen-qwen.mjs --script <script.json> --out <dir> [--panels 2,14] [--refs-only]

import fs from "fs";
import path from "path";

const HERE = import.meta.dirname;
function arg(name, def) { const i = process.argv.indexOf(`--${name}`); if (i === -1) return def; const v = process.argv[i + 1]; return v && !v.startsWith("--") ? v : true; }
const has = (name) => process.argv.includes(`--${name}`);

const scriptPath = arg("script"); const outDir = arg("out");
if (!scriptPath || !outDir) { console.error("--script and --out required"); process.exit(2); }
const ENDPOINT = String(arg("endpoint", process.env.DASHSCOPE_ENDPOINT
  || "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"));
const GEN_MODEL = String(arg("gen-model", "qwen-image-max"));        // text->image (ref sheets)
const EDIT_MODEL = String(arg("edit-model", "qwen-image-edit-max")); // image+text (panels)
const onlyPanels = arg("panels") ? String(arg("panels")).split(",").map(Number) : null;

const tokenFile = path.join(HERE, ".dashscope-token");
const KEY = (process.env.DASHSCOPE_API_KEY || (fs.existsSync(tokenFile) ? fs.readFileSync(tokenFile, "utf8") : "")).trim();
if (!KEY) { console.error("No DashScope key. Put an International (Singapore) key in scripts/comic/.dashscope-token or env DASHSCOPE_API_KEY. Free signup (no card): https://www.alibabacloud.com/help/en/model-studio/"); process.exit(3); }

const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
const cast = script.cast || [];
const byId = Object.fromEntries(cast.map((c) => [c.id, c]));
const refsDir = path.join(outDir, "refs");
fs.mkdirSync(refsDir, { recursive: true });

// flat "ligne claire" ink look (documented Qwen line-art recipe) + explicit no-text.
const INK = "Flat minimalistic black and white high-contrast line drawing, coloring-book / ligne-claire style: precise continuous equal-width black ink outlines, simple flat shapes, light hatching only, caricatured expressive faces, strictly black and white, no gradients, no soft shading, no photorealism, plain white background.";
const NOTEXT = "A single clean illustration with no text, no words, no letters, no speech bubbles, no caption boxes, no panel borders.";
const NEG = "text, words, letters, numbers, speech bubbles, caption boxes, panel borders, colour, gradient, soft shading, photorealistic, 3d render, extra limbs, deformed hands";

const dataUri = (p) => `data:image/jpeg;base64,${fs.readFileSync(p).toString("base64")}`;

// POST to DashScope; content = [{image?},{text}]; returns the first output image as a buffer.
async function call(model, content, size, tries = 3) {
  const body = { model, input: { messages: [{ role: "user", content }] },
    parameters: { n: 1, size, watermark: false, prompt_extend: false, negative_prompt: NEG } };
  let lastErr = "";
  for (let a = 0; a < tries; a++) {
    try {
      const r = await fetch(ENDPOINT, { method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
        body: JSON.stringify(body), signal: AbortSignal.timeout(180000) });
      const j = await r.json();
      if (!r.ok) { lastErr = JSON.stringify(j).slice(0, 300); if (r.status === 429) { await new Promise((z) => setTimeout(z, 8000)); continue; } throw new Error(lastErr); }
      const parts = j.output?.choices?.[0]?.message?.content || [];
      const url = parts.find((p) => p.image)?.image;
      if (!url) { lastErr = "no image in response: " + JSON.stringify(j).slice(0, 300); throw new Error(lastErr); }
      const img = await fetch(url, { signal: AbortSignal.timeout(120000) });
      if (!img.ok) throw new Error(`download ${img.status}`);
      return Buffer.from(await img.arrayBuffer());
    } catch (e) { lastErr = e.message; }
    await new Promise((z) => setTimeout(z, 3000));
  }
  throw new Error(lastErr || "gen failed");
}

// 1) build a flat-ink reference sheet for one character (text -> image)
async function buildRef(c) {
  const out = path.join(refsDir, `${c.id}.jpg`);
  if (fs.existsSync(out) && !has("refs-force")) { console.error(`· ref ${c.id} exists`); return out; }
  const text = `${INK} A character model sheet of ONE single figure — the SAME person shown front view, three-quarter view and side view, plus three facial expressions. ${c.name}: ${c.canonical}, ${c.anchor}. Keep the design simple and iconic with the exact same signature features in every view. ${NOTEXT}`;
  const buf = await call(GEN_MODEL, [{ text }], "1024*768");
  fs.writeFileSync(out, buf);
  console.error(`✓ ref ${c.id}  ${buf.length}B`);
  return out;
}

// 2) generate one panel by editing from the panel characters' reference sheets.
// References are role-labelled in the instruction so identity locks to the right person.
async function genPanel(p) {
  const outPath = path.join(outDir, `${String(p.n).padStart(2, "0")}.jpg`);
  const ids = (p.characters || []).filter((id) => fs.existsSync(path.join(refsDir, `${id}.jpg`)));
  const chars = ids.map((id) => byId[id]).filter(Boolean);
  const refLines = chars.map((c, i) => `Reference image ${i + 1} is the character sheet for ${c.name.toUpperCase()} — keep ${c.name} exactly identical to it (same face, hair, build, costume).`);
  const roster = chars.map((c) => `${c.name.toUpperCase()} (${c.canonical}, ${c.anchor})`).join("; ");
  let placement = "";
  if (chars.length === 2) placement = ` Place ${chars[0].name} on the left and ${chars[1].name} on the right, clearly apart.`;
  else if (chars.length >= 3) placement = " Show each character as a distinct full figure, spread apart.";
  const text = [INK, refLines.join(" "),
    roster ? `Characters in this scene: ${roster}.` : "",
    `Scene: ${p.scene}.`, `Composition: ${p.composition}.${placement}`,
    "Fill the frame with the scene, the main subject prominent and fully inside the edges, not cropped.",
    NOTEXT].filter(Boolean).join(" ");
  const content = [...ids.map((id) => ({ image: dataUri(path.join(refsDir, `${id}.jpg`)) })), { text }];
  const size = p.wide ? "1152*648" : "864*1152";
  const buf = await call(EDIT_MODEL, content, size);
  fs.writeFileSync(outPath, buf);
  console.error(`✓ panel ${p.n}  ${buf.length}B  (refs: ${ids.join(",") || "none"})`);
}

// ---- run ----
console.error(`→ Qwen (gen=${GEN_MODEL}, edit=${EDIT_MODEL}); refs for: ${cast.map((c) => c.id).join(", ")}`);
for (const c of cast) { try { await buildRef(c); } catch (e) { console.error(`✗ ref ${c.id}: ${e.message}`); } }
if (has("refs-only")) { console.error("refs-only done"); process.exit(0); }
let ok = 0, fail = 0;
for (const p of [...script.panels].sort((a, b) => a.n - b.n)) {
  if (onlyPanels && !onlyPanels.includes(p.n)) continue;
  try { await genPanel(p); ok++; } catch (e) { console.error(`✗ panel ${p.n}: ${e.message}`); fail++; }
}
console.error(`\ndone — ${ok} panels, ${fail} failed`);
