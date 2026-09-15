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
import { NEG, SIZES, panelDims, useNoref, refPromptText, panelPromptText } from "./comic-prompt.mjs";

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
// resolution tiers + close-up routing live in comic-prompt.mjs (shared). DashScope wants a
// "W*H" string; format the shared px dims. AUTO_NOREF disable flag: --no-auto-noref.
const AUTO_NOREF = !has("no-auto-noref");
const qwenSize = (p) => { const d = panelDims(p); return `${d.w}*${d.h}`; };
const REF_SIZE = `${SIZES.full.w}*${SIZES.full.h}`;

const tokenFile = path.join(HERE, ".dashscope-token");
const KEY = (process.env.DASHSCOPE_API_KEY || (fs.existsSync(tokenFile) ? fs.readFileSync(tokenFile, "utf8") : "")).trim();
if (!KEY) { console.error("No DashScope key. Put an International (Singapore) key in scripts/comic/.dashscope-token or env DASHSCOPE_API_KEY. Free signup (no card): https://www.alibabacloud.com/help/en/model-studio/"); process.exit(3); }

const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
const cast = script.cast || [];
const byId = Object.fromEntries(cast.map((c) => [c.id, c]));
const refsDir = path.join(outDir, "refs");
fs.mkdirSync(refsDir, { recursive: true });

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

// 1) build a character reference sheet (text -> image).
// A multi-view sheet (front + 3/4 + side + expressions) is the RIGHT edit anchor here: a
// single figure on a plain white background makes qwen-image-edit under-edit (it keeps the
// white background and drops the scene). The sheet gives rich identity AND lets the edit
// model repaint a full scene. The only failure it caused was duplicate heads leaking into
// WIDE panels — fixed by keeping edit panels portrait (see genPanel) + anti-dup negatives.
async function buildRef(c) {
  const out = path.join(refsDir, `${c.id}.jpg`);
  if (fs.existsSync(out) && !has("refs-force")) { console.error(`· ref ${c.id} exists`); return out; }
  const buf = await call(GEN_MODEL, [{ text: refPromptText(c) }], REF_SIZE);
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
  // route close-ups / costume-divergent / ref-less panels to t2i (see comic-prompt.useNoref)
  const noref = useNoref(p, ids.length, { forceNoref: has("noref"), autoNoref: AUTO_NOREF });
  const text = panelPromptText(p, chars, { noref });
  const size = qwenSize(p);
  const buf = noref
    ? await call(GEN_MODEL, [{ text }], size)
    : await call(EDIT_MODEL, [...ids.map((id) => ({ image: dataUri(path.join(refsDir, `${id}.jpg`)) })), { text }], size);
  fs.writeFileSync(outPath, buf);
  console.error(`✓ panel ${p.n}  ${buf.length}B  (${noref ? "t2i/noref" : "refs: " + ids.join(",")})`);
}

// ---- run ----
// space calls out — the free tier throttles on QPS (Throttling.RateQuota), so a short
// gap between sequential calls avoids losing an image to a burst.
const GAP = Number(arg("gap", 3000));
const pause = () => new Promise((z) => setTimeout(z, GAP));
console.error(`→ Qwen (gen=${GEN_MODEL}, edit=${EDIT_MODEL}); refs for: ${cast.map((c) => c.id).join(", ")}`);
for (const c of cast) { try { await buildRef(c); } catch (e) { console.error(`✗ ref ${c.id}: ${e.message}`); } await pause(); }
if (has("refs-only")) { console.error("refs-only done"); process.exit(0); }
let ok = 0, fail = 0;
for (const p of [...script.panels].sort((a, b) => a.n - b.n)) {
  if (onlyPanels && !onlyPanels.includes(p.n)) continue;
  try { await genPanel(p); ok++; } catch (e) { console.error(`✗ panel ${p.n}: ${e.message}`); fail++; }
  await pause();
}
console.error(`\ndone — ${ok} panels, ${fail} failed`);
