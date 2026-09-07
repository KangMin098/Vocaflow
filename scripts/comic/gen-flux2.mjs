// scripts/comic/gen-flux2.mjs
// FLUX.2 dev(GGUF Q4 + Turbo LoRA) 백엔드 — GONICK 화풍 + 다중참조 캐릭터 일관성.
// 캐릭터 시트(흰 배경 단일 인물, R26)를 t2i로 만들고, 각 패널을 그 시트들로 ReferenceLatent
// 체인 조건화해 생성한다. 공유 참조로 전권 캐릭터 고정. gen-gptimage 의 자가호스트 대응물.
//   node gen-flux2.mjs --script S.json --out DIR [--panels 6,8] [--refs-only] [--style gonick]
//     [--w 832 --h 1216 --steps 8 --cfg 1.0 --guidance 3.5]
import fs from "fs"; import path from "path";
import { refPromptText, panelPromptText, negForLevel, GONICK, styleForLevel } from "./comic-prompt.mjs";
const HERE = import.meta.dirname;
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); if (i === -1) return d; const v = process.argv[i + 1]; return v && !v.startsWith("--") ? v : d; };
const has = (n) => process.argv.includes(`--${n}`);
const COMFY = String(arg("comfy", process.env.COMFY_URL || fs.readFileSync(path.join(HERE, ".comfy-url"), "utf8").trim())).replace(/\/$/, "");
const SCRIPT = arg("script"), OUT = arg("out");
if (!SCRIPT || !OUT) { console.error("--script, --out 필수"); process.exit(2); }
const script = JSON.parse(fs.readFileSync(path.isAbsolute(SCRIPT) ? SCRIPT : path.join(process.cwd(), SCRIPT), "utf8"));
const VLEVEL = script.adaptation?.target_v_level ?? 7;
const STYLE = arg("style") === "gonick" ? GONICK : arg("style") ? { webtoon: null }[arg("style")] : GONICK;
const byId = Object.fromEntries((script.cast || []).map((c) => [c.id, c]));
const W = +arg("w", 832), Hh = +arg("h", 1216), STEPS = +arg("steps", 8), CFG = +arg("cfg", 1.0), GUID = +arg("guidance", 3.5);
const onlyPanels = arg("panels") ? String(arg("panels")).split(",").map(Number) : null;
const refsDir = path.join(OUT, "refs"); fs.mkdirSync(refsDir, { recursive: true });
const BWLEAD = STYLE === GONICK ? "STRICTLY black-and-white ink cartoon, no colour. ONE single full scene, NO panel borders, NO speech balloons. " : "";
const AVOID = `Absolutely AVOID: ${negForLevel(VLEVEL, STYLE)}.`;
const refPath = (id) => path.join(refsDir, `${id}.png`);
const nnPath = (n) => path.join(OUT, `${String(n).padStart(2, "0")}.jpg`);
const uploaded = {}; // id → comfy filename

let COOKIE = "";
async function login() {
  const lb = COMFY.replace(/-8188\./, "-1111.");
  const r = await fetch(lb + "/login", { method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "user=user&password=password", signal: AbortSignal.timeout(20000) });
  const m = (r.headers.get("set-cookie") || "").match(/ai_dock_[a-f0-9]+_token=[^;]+/i); if (m) COOKIE = m[0];
  console.error("login", m ? "OK" : "?");
}
const H = (h = {}) => COOKIE ? { ...h, Cookie: COOKIE } : h;
async function uploadImg(buf, name) {
  const fd = new FormData(); fd.append("image", new Blob([buf]), name); fd.append("overwrite", "true");
  const r = await fetch(COMFY + "/upload/image", { method: "POST", headers: H(), body: fd, signal: AbortSignal.timeout(60000) });
  return (await r.json()).name;
}
async function runWF(wf, tag) {
  const t0 = Date.now();
  let prompt_id = null;
  for (let a = 0; a < 4 && !prompt_id; a++) { // /prompt 전송(일시 오류 재시도)
    try { const q = await fetch(COMFY + "/prompt", { method: "POST", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ prompt: wf }), signal: AbortSignal.timeout(30000) });
      if (!q.ok) { console.error(`${tag} /prompt ${q.status}: ${(await q.text()).slice(0, 160)}`); return null; }
      prompt_id = (await q.json()).prompt_id;
    } catch (e) { await new Promise((z) => setTimeout(z, 4000)); }
  }
  if (!prompt_id) { console.error(`${tag} /prompt 실패(네트워크)`); return null; }
  for (let i = 0; i < 200; i++) {
    await new Promise((z) => setTimeout(z, 2000));
    try {
      const hj = await (await fetch(COMFY + `/history/${prompt_id}`, { headers: H(), signal: AbortSignal.timeout(30000) })).json(); const rec = hj[prompt_id];
      if (rec?.outputs) { for (const o of Object.values(rec.outputs)) for (const im of (o.images || [])) {
        const u = new URLSearchParams({ filename: im.filename, subfolder: im.subfolder || "", type: im.type || "output" });
        const buf = Buffer.from(await (await fetch(COMFY + "/view?" + u, { headers: H(), signal: AbortSignal.timeout(120000) })).arrayBuffer());
        console.error(`✓ ${tag} in ${((Date.now() - t0) / 1000).toFixed(1)}s`); return buf; } return null; }
      if (rec?.status?.status_str === "error") { console.error(`${tag} ERROR ${JSON.stringify(rec.status).slice(0, 300)}`); return null; }
    } catch (e) { /* ECONNRESET 등 일시 오류 — 폴링 계속 */ }
  }
  console.error(`${tag} timeout`); return null;
}
// 공통 로더 노드
const loaders = () => ({
  "1": { class_type: "UnetLoaderGGUF", inputs: { unet_name: "flux2-dev-Q4_K_M.gguf" } },
  "11": { class_type: "LoraLoaderModelOnly", inputs: { lora_name: "Flux2TurboComfyv2.safetensors", strength_model: 1.0, model: ["1", 0] } },
  "2": { class_type: "CLIPLoader", inputs: { clip_name: "mistral_3_small_flux2_fp4_mixed.safetensors", type: "flux2" } },
  "3": { class_type: "VAELoader", inputs: { vae_name: "flux2-vae.safetensors" } },
});
const sampler = (posNode, seed) => ({
  "5": { class_type: "CLIPTextEncode", inputs: { text: negForLevel(VLEVEL, STYLE), clip: ["2", 0] } },
  "6": { class_type: "EmptySD3LatentImage", inputs: { width: W, height: Hh, batch_size: 1 } },
  "12": { class_type: "FluxGuidance", inputs: { guidance: GUID, conditioning: posNode } },
  "7": { class_type: "KSampler", inputs: { seed, steps: STEPS, cfg: CFG, sampler_name: "euler", scheduler: "simple", denoise: 1, model: ["11", 0], positive: ["12", 0], negative: ["5", 0], latent_image: ["6", 0] } },
  "10": { class_type: "VAEDecode", inputs: { samples: ["7", 0], vae: ["3", 0] } },
  "9": { class_type: "SaveImage", inputs: { images: ["10", 0], filename_prefix: "flux2" } },
});
const seedOf = (k) => Math.floor(Math.abs(Math.sin(k * 97 + 13) * 1e9));

async function buildRef(c) {
  if (fs.existsSync(refPath(c.id))) { console.error(`· ref ${c.id} 있음`); }
  else {
    const wf = { ...loaders(), "4": { class_type: "CLIPTextEncode", inputs: { text: `${BWLEAD}${refPromptText(c, VLEVEL, STYLE)} ${AVOID}`, clip: ["2", 0] } }, ...sampler(["4", 0], seedOf(c.id.length + 1)) };
    const buf = await runWF(wf, `ref ${c.id}`); if (!buf) return;
    fs.writeFileSync(refPath(c.id), buf);
  }
  if (!uploaded[c.id]) uploaded[c.id] = await uploadImg(fs.readFileSync(refPath(c.id)), `flux_${c.id}.png`);
}
async function genPanel(p) {
  if (fs.existsSync(nnPath(p.n)) && !has("force")) { console.error(`· panel ${p.n} 있음(skip)`); return; }
  const chars = (p.characters || []).map((id) => byId[id]).filter((c) => c && fs.existsSync(refPath(c.id)));
  const prompt = `${BWLEAD}${panelPromptText(p, chars, { noref: false, vlevel: VLEVEL, style: STYLE })} ${AVOID}`;
  const wf = { ...loaders(), "4": { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["2", 0] } } };
  // ref 체인: 각 캐릭터 시트 → LoadImage→VAEEncode→ReferenceLatent (conditioning 체인)
  let cond = ["4", 0];
  chars.forEach((c, i) => {
    const li = `L${i}`, ve = `E${i}`, rl = `R${i}`;
    wf[li] = { class_type: "LoadImage", inputs: { image: uploaded[c.id] } };
    wf[ve] = { class_type: "VAEEncode", inputs: { pixels: [li, 0], vae: ["3", 0] } };
    wf[rl] = { class_type: "ReferenceLatent", inputs: { conditioning: cond, latent: [ve, 0] } };
    cond = [rl, 0];
  });
  Object.assign(wf, sampler(cond, seedOf(p.n)));
  const buf = await runWF(wf, `panel ${p.n} (${chars.map((c) => c.id).join(",") || "noref"})`);
  if (buf) fs.writeFileSync(nnPath(p.n), buf);
}

await login();
console.error(`FLUX.2 | V${VLEVEL} ${(STYLE && STYLE.register) || styleForLevel(VLEVEL).register} | ${W}x${Hh} ${STEPS}st | ${COMFY.replace(/^https?:\/\//, "").slice(0, 24)}`);
for (const c of (script.cast || [])) await buildRef(c);
if (has("refs-only")) { console.error("refs-only 완료"); process.exit(0); }
for (const p of [...script.panels].sort((a, b) => a.n - b.n)) { if (onlyPanels && !onlyPanels.includes(p.n)) continue; await genPanel(p); }
console.error("done");
