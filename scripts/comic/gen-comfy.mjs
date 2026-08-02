// scripts/comic/gen-comfy.mjs
// Self-hosted backend adapter: drives a ComfyUI running Qwen-Image-Edit (e.g. on a free
// Kaggle P100 exposed via a cloudflared tunnel). Same house style + Vision-QC fixes as the
// cloud adapters (shared comic-prompt.mjs), so output matches gen-qwen — but $0 and
// LoRA-tunable. Two-stage: buildRef (t2i sheet) → genPanel (edit from that sheet, or t2i
// for close-ups / --noref).
//
// It does NOT hardcode a ComfyUI node graph (those are environment-specific). Instead you
// export a WORKING workflow from your ComfyUI in "Save (API Format)" and pass it as a
// TEMPLATE; this adapter injects the per-panel prompt / size / reference-image by NODE TITLE.
// In ComfyUI, title the nodes (double-click title): the positive-prompt node "PROMPT", the
// negative "NEG", the latent/size node "SIZE", and (edit workflow only) the reference
// LoadImage node "REFIMAGE".
//
// Setup: see scripts/comic/kaggle/ for the Kaggle notebook that launches ComfyUI + tunnel.
//
// Usage:
//   COMFY_URL=https://<tunnel>.trycloudflare.com \
//   node scripts/comic/gen-comfy.mjs --script <script.json> --out <dir> \
//        --wf-gen wf/qwen-t2i.api.json --wf-edit wf/qwen-edit.api.json [--panels 2,14] [--refs-only]

import fs from "fs";
import path from "path";
import { NEG, SIZES, panelDims, useNoref, refPromptText, panelPromptText } from "./comic-prompt.mjs";

const HERE = import.meta.dirname;
function arg(name, def) { const i = process.argv.indexOf(`--${name}`); if (i === -1) return def; const v = process.argv[i + 1]; return v && !v.startsWith("--") ? v : true; }
const has = (name) => process.argv.includes(`--${name}`);

const scriptPath = arg("script"); const outDir = arg("out");
if (!scriptPath || !outDir) { console.error("--script and --out required"); process.exit(2); }
const COMFY = String(arg("comfy", process.env.COMFY_URL || "")).replace(/\/$/, "");
if (!COMFY) { console.error("No ComfyUI URL. Set env COMFY_URL or --comfy <tunnel-url> (see scripts/comic/kaggle/)."); process.exit(3); }
const WF_GEN = arg("wf-gen"); const WF_EDIT = arg("wf-edit");
if (!WF_GEN) { console.error("--wf-gen <workflow.api.json> required (a ComfyUI t2i workflow exported as API format)"); process.exit(3); }
const onlyPanels = arg("panels") ? String(arg("panels")).split(",").map(Number) : null;
const AUTO_NOREF = !has("no-auto-noref");
const GAP = Number(arg("gap", 800));
// node-title conventions (override if your workflow uses different titles)
const T_PROMPT = String(arg("title-prompt", "PROMPT"));
const T_NEG = String(arg("title-neg", "NEG"));
const T_SIZE = String(arg("title-size", "SIZE"));
const T_REF = String(arg("title-refimage", "REFIMAGE"));

const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
const cast = script.cast || [];
const byId = Object.fromEntries(cast.map((c) => [c.id, c]));
const refsDir = path.join(outDir, "refs");
fs.mkdirSync(refsDir, { recursive: true });
const loadWF = (f) => JSON.parse(fs.readFileSync(path.isAbsolute(f) ? f : path.join(process.cwd(), f), "utf8"));
const clientId = "vocaflow-comic";

// --- ComfyUI REST helpers ---
const titleOf = (node) => (node && node._meta && node._meta.title) || "";
// set inputs[key]=value on the FIRST node whose title contains `titleSub` (case-insensitive);
// optional class_type regex fallback (used for the latent/size node).
function inject(wf, titleSub, setter, classRe) {
  const sub = titleSub.toLowerCase();
  let hit = Object.values(wf).find((n) => titleOf(n).toLowerCase().includes(sub));
  if (!hit && classRe) hit = Object.values(wf).find((n) => classRe.test(n.class_type || ""));
  if (hit) setter(hit);
  return !!hit;
}

async function uploadImage(filePath) {
  const buf = fs.readFileSync(filePath);
  const fd = new FormData();
  fd.append("image", new Blob([buf], { type: "image/jpeg" }), path.basename(filePath));
  fd.append("overwrite", "true");
  const r = await fetch(`${COMFY}/upload/image`, { method: "POST", body: fd, signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`upload ${r.status}`);
  const j = await r.json();
  return j.subfolder ? `${j.subfolder}/${j.name}` : j.name;
}

// queue a workflow, poll history, download the first output image → Buffer
async function runWorkflow(wf, tries = 2) {
  let lastErr = "";
  for (let a = 0; a < tries; a++) {
    try {
      const q = await fetch(`${COMFY}/prompt`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: wf, client_id: clientId }), signal: AbortSignal.timeout(60000) });
      if (!q.ok) { lastErr = `queue ${q.status}: ${(await q.text()).slice(0, 300)}`; throw new Error(lastErr); }
      const { prompt_id } = await q.json();
      // poll history until the job appears with outputs (ComfyUI runs async)
      for (let i = 0; i < 240; i++) {
        await new Promise((z) => setTimeout(z, 2000));
        const h = await fetch(`${COMFY}/history/${prompt_id}`, { signal: AbortSignal.timeout(30000) });
        if (!h.ok) continue;
        const hist = (await h.json())[prompt_id];
        if (!hist) continue;
        if (hist.status && hist.status.status_str === "error") { lastErr = "workflow error: " + JSON.stringify(hist.status).slice(0, 300); throw new Error(lastErr); }
        const outs = hist.outputs || {};
        const imgMeta = Object.values(outs).flatMap((o) => o.images || [])[0];
        if (imgMeta) {
          const u = new URLSearchParams({ filename: imgMeta.filename, subfolder: imgMeta.subfolder || "", type: imgMeta.type || "output" });
          const img = await fetch(`${COMFY}/view?${u}`, { signal: AbortSignal.timeout(120000) });
          if (!img.ok) throw new Error(`view ${img.status}`);
          return Buffer.from(await img.arrayBuffer());
        }
      }
      lastErr = "timed out waiting for output";
    } catch (e) { lastErr = e.message; }
    await new Promise((z) => setTimeout(z, 3000));
  }
  throw new Error(lastErr || "comfy failed");
}

function fillCommon(wf, prompt, w, h) {
  inject(wf, T_PROMPT, (n) => { n.inputs.text = prompt; });
  inject(wf, T_NEG, (n) => { n.inputs.text = NEG; });
  inject(wf, T_SIZE, (n) => { if ("width" in n.inputs) n.inputs.width = w; if ("height" in n.inputs) n.inputs.height = h; }, /EmptyLatent|EmptySD3|Latent.*Image|Empty.*Latent/i);
}

// 1) reference sheet (t2i)
async function buildRef(c) {
  const out = path.join(refsDir, `${c.id}.jpg`);
  if (fs.existsSync(out) && !has("refs-force")) { console.error(`· ref ${c.id} exists`); return out; }
  const wf = loadWF(WF_GEN);
  fillCommon(wf, refPromptText(c), SIZES.full.w, SIZES.full.h);
  const buf = await runWorkflow(wf);
  fs.writeFileSync(out, buf);
  console.error(`✓ ref ${c.id}  ${buf.length}B`);
  return out;
}

// 2) panel — edit from the character's reference sheet, or t2i for close-ups / --noref
async function genPanel(p) {
  const outPath = path.join(outDir, `${String(p.n).padStart(2, "0")}.jpg`);
  const ids = (p.characters || []).filter((id) => fs.existsSync(path.join(refsDir, `${id}.jpg`)));
  const chars = ids.map((id) => byId[id]).filter(Boolean);
  const noref = useNoref(p, ids.length, { forceNoref: has("noref"), autoNoref: AUTO_NOREF });
  const d = panelDims(p);
  const text = panelPromptText(p, chars, { noref });
  let wf, mode;
  if (noref || !WF_EDIT) { wf = loadWF(WF_GEN); fillCommon(wf, text, d.w, d.h); mode = "t2i/noref"; }
  else {
    wf = loadWF(WF_EDIT);
    fillCommon(wf, text, d.w, d.h);
    // single-subject design → one primary reference; upload it and point REFIMAGE at it
    const refName = await uploadImage(path.join(refsDir, `${ids[0]}.jpg`));
    if (!inject(wf, T_REF, (n) => { n.inputs.image = refName; })) throw new Error(`no node titled "${T_REF}" in edit workflow`);
    mode = "edit:" + ids[0];
  }
  const buf = await runWorkflow(wf);
  fs.writeFileSync(outPath, buf);
  console.error(`✓ panel ${p.n}  ${buf.length}B  (${mode})`);
}

// ---- run ----
const pause = () => new Promise((z) => setTimeout(z, GAP));
console.error(`→ ComfyUI @ ${COMFY}; refs for: ${cast.map((c) => c.id).join(", ")}`);
for (const c of cast) { try { await buildRef(c); } catch (e) { console.error(`✗ ref ${c.id}: ${e.message}`); } await pause(); }
if (has("refs-only")) { console.error("refs-only done"); process.exit(0); }
let ok = 0, fail = 0;
for (const p of [...script.panels].sort((a, b) => a.n - b.n)) {
  if (onlyPanels && !onlyPanels.includes(p.n)) continue;
  try { await genPanel(p); ok++; } catch (e) { console.error(`✗ panel ${p.n}: ${e.message}`); fail++; }
  await pause();
}
console.error(`\ndone — ${ok} panels, ${fail} failed`);
