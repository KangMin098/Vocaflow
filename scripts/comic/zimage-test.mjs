// scripts/comic/zimage-test.mjs — Z-Image Turbo t2i 테스트(Gonick 프롬프트). ai-dock 로그인 + 직접 /prompt.
// node zimage-test.mjs --script S.json --out DIR --panels 1,6 [--w 832 --h 1216 --steps 8 --cfg 1.5]
import fs from "fs"; import path from "path";
import { panelPromptText, negForLevel, GONICK } from "./comic-prompt.mjs";
const HERE = import.meta.dirname;
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); if (i === -1) return d; const v = process.argv[i + 1]; return v && !v.startsWith("--") ? v : true; };
const COMFY = String(arg("comfy", process.env.COMFY_URL || fs.readFileSync(path.join(HERE, ".comfy-url"), "utf8").trim())).replace(/\/$/, "");
const SCRIPT = arg("script"), OUT = arg("out"); fs.mkdirSync(OUT, { recursive: true });
const script = JSON.parse(fs.readFileSync(path.isAbsolute(SCRIPT) ? SCRIPT : path.join(process.cwd(), SCRIPT), "utf8"));
const VLEVEL = script.adaptation?.target_v_level ?? 7;
const byId = Object.fromEntries((script.cast || []).map((c) => [c.id, c]));
const W = +arg("w", 832), Hh = +arg("h", 1216), STEPS = +arg("steps", 8), CFG = +arg("cfg", 1.5);
const panels = String(arg("panels", "1")).split(",").map(Number);
const AVOID = `Absolutely AVOID: ${negForLevel(VLEVEL, GONICK)}.`;
const NOTXT = "NO text, NO words, NO letters, NO speech balloons anywhere.";
let COOKIE = "";
async function login() {
  const lb = COMFY.replace(/-8188\./, "-1111.");
  const r = await fetch(lb + "/login", { method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "user=user&password=password", signal: AbortSignal.timeout(20000) });
  const m = (r.headers.get("set-cookie") || "").match(/ai_dock_[a-f0-9]+_token=[^;]+/i); if (m) { COOKIE = m[0]; console.error("login OK"); }
}
const H = (h = {}) => COOKIE ? { ...h, Cookie: COOKIE } : h;
async function gen(n) {
  const p = (script.panels || []).find((x) => x.n === n); if (!p) return;
  const chars = (p.characters || []).map((id) => byId[id]).filter(Boolean);
  // Z-Image 는 negative 를 거의 안 쓰므로 핵심 제약을 POSITIVE 로 강제(맨 앞).
  const BWLEAD = "STRICTLY BLACK AND WHITE monochrome pen-and-ink line drawing, absolutely NO colour, no grey photo. ONE single full-bleed illustration filling the whole frame — NO panel borders, NO grid, NO speech balloons, NO empty bubbles, NO ghosts, NO extra floating figures. ";
  const prompt = arg("prompt") && arg("prompt") !== true ? String(arg("prompt")) : `${BWLEAD}${panelPromptText(p, chars, { noref: true, vlevel: VLEVEL, style: GONICK })} ${NOTXT} ${AVOID}`;
  const wf = JSON.parse(fs.readFileSync(path.join(HERE, "wf", String(arg("wf", "zimage-turbo.api.json"))), "utf8"));
  for (const k of Object.keys(wf)) if (k.startsWith("_")) delete wf[k]; // ComfyUI /prompt 500s on non-node keys
  wf["4"].inputs.text = prompt; wf["5"].inputs.text = negForLevel(VLEVEL, GONICK);
  wf["6"].inputs.width = W; wf["6"].inputs.height = Hh;
  wf["7"].inputs.seed = Math.floor(Math.abs(Math.sin(n * 999) * 1e9)); wf["7"].inputs.steps = STEPS; wf["7"].inputs.cfg = CFG;
  wf["9"].inputs.filename_prefix = `zt_${n}`;
  const t0 = Date.now();
  const q = await fetch(COMFY + "/prompt", { method: "POST", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ prompt: wf }), signal: AbortSignal.timeout(30000) });
  if (!q.ok) { console.error(`p${n} /prompt ${q.status}: ${(await q.text()).slice(0, 200)}`); return; }
  const { prompt_id } = await q.json();
  for (let i = 0; i < 120; i++) {
    await new Promise((z) => setTimeout(z, 2000));
    const hr = await fetch(COMFY + `/history/${prompt_id}`, { headers: H(), signal: AbortSignal.timeout(20000) });
    const hj = await hr.json(); const rec = hj[prompt_id];
    if (rec && rec.outputs) {
      for (const o of Object.values(rec.outputs)) for (const im of (o.images || [])) {
        const u = new URLSearchParams({ filename: im.filename, subfolder: im.subfolder || "", type: im.type || "output" });
        const iv = await fetch(COMFY + "/view?" + u, { headers: H(), signal: AbortSignal.timeout(60000) });
        fs.writeFileSync(path.join(OUT, `${String(n).padStart(2, "0")}.jpg`), Buffer.from(await iv.arrayBuffer()));
        console.error(`✓ p${n} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      }
      return;
    }
    if (rec && rec.status?.status_str === "error") { console.error(`p${n} ERROR`, JSON.stringify(rec.status).slice(0, 300)); return; }
  }
  console.error(`p${n} timeout`);
}
await login();
console.error(`Z-Image Turbo | ${W}x${Hh} ${STEPS}step cfg${CFG} | panels ${panels.join(",")}`);
for (const n of panels) await gen(n);
console.error("done");
