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
import { Jimp } from "jimp";
import { negForLevel, SIZES, panelDims, useNoref, refPromptText, panelPromptText, styleForLevel } from "./comic-prompt.mjs";

const HERE = import.meta.dirname;
function arg(name, def) { const i = process.argv.indexOf(`--${name}`); if (i === -1) return def; const v = process.argv[i + 1]; return v && !v.startsWith("--") ? v : true; }
const has = (name) => process.argv.includes(`--${name}`);

const scriptPath = arg("script"); const outDir = arg("out");
if (!scriptPath || !outDir) { console.error("--script and --out required"); process.exit(2); }
let COMFY = String(arg("comfy", process.env.COMFY_URL || "")).replace(/\/$/, "");
if (!COMFY) { console.error("No ComfyUI URL. Set env COMFY_URL or --comfy <tunnel-url> (see scripts/comic/kaggle/)."); process.exit(3); }
// Auth. Two mechanisms, both supported:
//  1) HTTP Basic (Authorization header) — plain reverse-proxy basic-auth or URL userinfo.
//  2) AI-Dock (RunPod) form login — the ComfyUI port (…-8188…) 302-redirects to the portal
//     (…-1111…/login). We POST user/pass to the portal /login, capture the ai_dock_*_token
//     cookie (same signing secret across ports), and send it as a Cookie header to 8188.
// Creds: --user/--pass, COMFY_USER/COMFY_PASS, or URL userinfo. Portal URL is auto-derived by
// swapping the -<port>- proxy segment to -1111- (override with --login-url / COMFY_LOGIN_URL).
let CRED_USER = arg("user", process.env.COMFY_USER || "");
let CRED_PASS = arg("pass", process.env.COMFY_PASS || "");
try {
  const u = new URL(COMFY);
  if (u.username) { CRED_USER = CRED_USER || decodeURIComponent(u.username); CRED_PASS = CRED_PASS || decodeURIComponent(u.password); u.username = ""; u.password = ""; COMFY = u.toString().replace(/\/$/, ""); }
} catch {}
let AUTH_HEADER = CRED_USER ? { Authorization: "Basic " + Buffer.from(`${CRED_USER}:${CRED_PASS}`).toString("base64") } : null;
let COOKIE = process.env.COMFY_COOKIE || ""; // set directly, or filled by aiDockLogin()
const authHeaders = (extra) => {
  const h = { ...(extra || {}), ...(AUTH_HEADER || {}) };
  if (COOKIE) h.Cookie = COOKIE;
  return h;
};
// If ComfyUI redirects to an AI-Dock login portal, obtain a session cookie once.
async function aiDockLogin() {
  if (COOKIE || !CRED_USER) return;
  // does 8188 redirect to a portal /login?
  let loginBase = arg("login-url", process.env.COMFY_LOGIN_URL || "");
  try {
    const probe = await fetch(`${COMFY}/system_stats`, { redirect: "manual", signal: AbortSignal.timeout(20000) });
    if (probe.status === 200) return; // no portal auth needed
    const loc = probe.headers.get("location") || "";
    if (!loginBase && /\/login/i.test(loc)) loginBase = loc.replace(/\/login.*$/i, "");
  } catch {}
  if (!loginBase) loginBase = COMFY.replace(/-(\d+)\.proxy\.runpod\.net/i, "-1111.proxy.runpod.net"); // AI-Dock portal
  // the probe's Location is often http:// — force https so the POST isn't 301-redirected before auth
  loginBase = loginBase.replace(/^http:/i, "https:").replace(/\/$/, "");
  const body = new URLSearchParams({ user: CRED_USER, password: CRED_PASS }).toString();
  const r = await fetch(`${loginBase}/login`, { method: "POST", redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(25000) });
  const sc = r.headers.get("set-cookie") || "";
  const m = sc.match(/ai_dock_[a-f0-9]+_token=[^;]+/i);
  if (m) { COOKIE = m[0]; console.error(`✓ AI-Dock login OK (${loginBase.replace(/^https?:\/\//, "")})`); }
  else console.error(`! AI-Dock login: no token cookie (status ${r.status}) — check --user/--pass`);
}
const WF_GEN = arg("wf-gen"); const WF_EDIT = arg("wf-edit");
if (!WF_GEN) { console.error("--wf-gen <workflow.api.json> required (a ComfyUI t2i workflow exported as API format)"); process.exit(3); }
const onlyPanels = arg("panels") ? String(arg("panels")).split(",").map(Number) : null;
// S2.5 corrective repair: per-panel regen_hint from a QC verdicts file → injected into the prompt
// so a failed panel is re-generated WITH the fix, not just re-rolled on a new seed.
const HINTS = (() => { const f = arg("hints"); if (!f) return {}; try { const v = JSON.parse(fs.readFileSync(f, "utf8")); const o = {}; for (const [k, r] of Object.entries(v)) if (r && r.regen_hint) o[k] = r.regen_hint; return o; } catch { return {}; } })();
const AUTO_NOREF = !has("no-auto-noref");
const GAP = Number(arg("gap", 800));
// node-title conventions (override if your workflow uses different titles)
const T_PROMPT = String(arg("title-prompt", "PROMPT"));
const T_NEG = String(arg("title-neg", "NEG"));
const T_SIZE = String(arg("title-size", "SIZE"));
const T_REF = String(arg("title-refimage", "REFIMAGE"));

const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
const cast = script.cast || [];
// R19: 도서 레벨에 맞춘 아트 레지스터 + 레벨-상대 NEG. --vlevel 로 강제 가능.
const VLEVEL = arg("vlevel") != null ? Number(arg("vlevel")) : (script.adaptation?.target_v_level ?? 6);
const NEG_L = negForLevel(VLEVEL);
console.error(`art register: ${styleForLevel(VLEVEL).register} (V-Level ${VLEVEL} +약간상향)`);
const byId = Object.fromEntries(cast.map((c) => [c.id, c]));
const refsDir = path.join(outDir, "refs");
fs.mkdirSync(refsDir, { recursive: true });
const loadWF = (f) => {
  const raw = JSON.parse(fs.readFileSync(path.isAbsolute(f) ? f : path.join(process.cwd(), f), "utf8"));
  // strip top-level non-node keys (e.g. "_note") — ComfyUI /prompt 500s on nodes without class_type
  const wf = {}; for (const [k, v] of Object.entries(raw)) if (!k.startsWith("_")) wf[k] = v;
  return wf;
};
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
  const r = await fetch(`${COMFY}/upload/image`, { method: "POST", body: fd, headers: authHeaders(), signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`upload ${r.status}`);
  const j = await r.json();
  return j.subfolder ? `${j.subfolder}/${j.name}` : j.name;
}

// queue a workflow, poll history, download the first output image → Buffer
async function runWorkflow(wf, tries = 2) {
  let lastErr = "";
  for (let a = 0; a < tries; a++) {
    try {
      const q = await fetch(`${COMFY}/prompt`, { method: "POST", headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ prompt: wf, client_id: clientId }), signal: AbortSignal.timeout(60000) });
      if (!q.ok) { lastErr = `queue ${q.status}: ${(await q.text()).slice(0, 300)}`; throw new Error(lastErr); }
      const { prompt_id } = await q.json();
      // poll history until the job appears with outputs (ComfyUI runs async)
      for (let i = 0; i < 240; i++) {
        await new Promise((z) => setTimeout(z, 2000));
        const h = await fetch(`${COMFY}/history/${prompt_id}`, { headers: authHeaders(), signal: AbortSignal.timeout(30000) });
        if (!h.ok) continue;
        const hist = (await h.json())[prompt_id];
        if (!hist) continue;
        if (hist.status && hist.status.status_str === "error") { lastErr = "workflow error: " + JSON.stringify(hist.status).slice(0, 300); throw new Error(lastErr); }
        const outs = hist.outputs || {};
        const imgMeta = Object.values(outs).flatMap((o) => o.images || [])[0];
        if (imgMeta) {
          const u = new URLSearchParams({ filename: imgMeta.filename, subfolder: imgMeta.subfolder || "", type: imgMeta.type || "output" });
          const img = await fetch(`${COMFY}/view?${u}`, { headers: authHeaders(), signal: AbortSignal.timeout(120000) });
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
  // CLIPTextEncode 는 .text, Qwen Edit(TextEncodeQwenImageEdit/Plus)는 .prompt 필드 — 둘 다 지원.
  const setText = (n, v) => { if ("prompt" in n.inputs) n.inputs.prompt = v; else n.inputs.text = v; };
  inject(wf, T_PROMPT, (n) => setText(n, prompt));
  inject(wf, T_NEG, (n) => setText(n, NEG_L));
  inject(wf, T_SIZE, (n) => { if ("width" in n.inputs) n.inputs.width = w; if ("height" in n.inputs) n.inputs.height = h; }, /EmptyLatent|EmptySD3|Latent.*Image|Empty.*Latent/i);
  // vary the sampler seed each call so retries / best-of-N / repair produce a DIFFERENT image
  // (fixed workflow seeds made regeneration reproduce the same defect — repair loop couldn't work).
  for (const n of Object.values(wf)) if (n.class_type === "KSampler" && n.inputs && "seed" in n.inputs) n.inputs.seed = Math.floor(Math.random() * 1e15);
}

// 1) reference sheet (t2i)
async function buildRef(c) {
  const out = path.join(refsDir, `${c.id}.jpg`);
  if (fs.existsSync(out) && !has("refs-force")) { console.error(`· ref ${c.id} exists`); return out; }
  const wf = loadWF(WF_GEN);
  fillCommon(wf, refPromptText(c, VLEVEL), SIZES.full.w, SIZES.full.h);
  const buf = await runWorkflow(wf);
  // center-crop to the single figure — the model draws faint duplicate torsos at the L/R edges of
  // a "single figure" ref, and those leak into edit panels as a phantom second person (4090 실측).
  let outBuf = buf;
  try {
    const img = await Jimp.read(buf); const W = img.bitmap.width;
    img.crop({ x: Math.round(W * 0.24), y: 0, w: Math.round(W * 0.52), h: img.bitmap.height });
    outBuf = await img.getBuffer("image/jpeg", { quality: 92 });
  } catch { /* jimp 실패 시 원본 사용 */ }
  fs.writeFileSync(out, outBuf);
  console.error(`✓ ref ${c.id}  ${outBuf.length}B`);
  return out;
}

// 2) panel — edit from the character's reference sheet, or t2i for close-ups / --noref
async function genPanel(p) {
  const outPath = path.join(outDir, `${String(p.n).padStart(2, "0")}${arg("suffix", "")}.jpg`);
  const ids = (p.characters || []).filter((id) => fs.existsSync(path.join(refsDir, `${id}.jpg`)));
  const chars = ids.map((id) => byId[id]).filter(Boolean);
  const noref = useNoref(p, ids.length, { forceNoref: has("noref"), autoNoref: AUTO_NOREF });
  const d = panelDims(p);
  let text = panelPromptText(p, chars, { noref, vlevel: VLEVEL });
  if (HINTS[p.n]) { text += ` IMPORTANT CORRECTION (fix this specifically): ${HINTS[p.n]}.`; console.error(`  ↳ P${p.n} correction: ${HINTS[p.n]}`); }
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
await aiDockLogin();
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
