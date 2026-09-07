// scripts/comic/flux2-ref-test.mjs — FLUX.2 다중참조 캐릭터 일관성 테스트.
// Scrooge 참조 1장 업로드 → 서로 다른 장면들을 그 참조로 생성 → 동일 인물 유지되는지 검증.
// node flux2-ref-test.mjs --ref out/flux2-test/01.jpg --out out/flux2-ref
import fs from "fs"; import path from "path";
import { GONICK, negForLevel } from "./comic-prompt.mjs";
const HERE = import.meta.dirname;
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); if (i === -1) return d; const v = process.argv[i + 1]; return v && !v.startsWith("--") ? v : true; };
const COMFY = String(arg("comfy", process.env.COMFY_URL || fs.readFileSync(path.join(HERE, ".comfy-url"), "utf8").trim())).replace(/\/$/, "");
const OUT = arg("out", "out/flux2-ref"); fs.mkdirSync(OUT, { recursive: true });
const REF = arg("ref", "out/flux2-test/01.jpg");
const AVOID = `Absolutely AVOID: ${negForLevel(7, GONICK)}.`;
const NOTXT = "NO text, NO speech balloons, NO panel borders.";
const BW = "STRICTLY black-and-white ink cartoon, no colour. ONE single full-bleed scene.";
const ANCHOR = "SCROOGE is a bald, thin, sour old miser with a long sharp pointed nose and gaunt clean-shaven face.";
const KEEP = "Keep SCROOGE's face and identity IDENTICAL to the reference image (same bald head, same long pointed nose, same gaunt features).";
const SCENES = {
  desk: "SCROOGE sits hunched at his counting-house desk counting coins by a single candle, cold and stern, ledgers and papers around him.",
  night: "SCROOGE in a striped nightgown and nightcap cowers by a small fireplace at night, terrified, hands raised.",
};
let COOKIE = "";
async function login() {
  const lb = COMFY.replace(/-8188\./, "-1111.");
  const r = await fetch(lb + "/login", { method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "user=user&password=password", signal: AbortSignal.timeout(20000) });
  const m = (r.headers.get("set-cookie") || "").match(/ai_dock_[a-f0-9]+_token=[^;]+/i); if (m) COOKIE = m[0];
  console.error("login", m ? "OK" : "?");
}
const H = (h = {}) => COOKIE ? { ...h, Cookie: COOKIE } : h;
async function upload() {
  const fd = new FormData();
  fd.append("image", new Blob([fs.readFileSync(REF)]), "scrooge_ref.png");
  fd.append("overwrite", "true");
  const r = await fetch(COMFY + "/upload/image", { method: "POST", headers: H(), body: fd, signal: AbortSignal.timeout(60000) });
  const j = await r.json(); console.error("upload ref →", j.name); return j.name;
}
async function gen(key, refName) {
  const wf = JSON.parse(fs.readFileSync(path.join(HERE, "wf", "flux2-ref.api.json"), "utf8"));
  for (const k of Object.keys(wf)) if (k.startsWith("_")) delete wf[k];
  wf["20"].inputs.image = refName;
  wf["4"].inputs.text = `${GONICK.ink} ${BW} ${ANCHOR} Scene: ${SCENES[key]} ${KEEP} ${NOTXT} ${AVOID}`;
  wf["5"].inputs.text = negForLevel(7, GONICK);
  wf["7"].inputs.seed = Math.floor(Math.abs(Math.sin(key.length * 7) * 1e9));
  const t0 = Date.now();
  const q = await fetch(COMFY + "/prompt", { method: "POST", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify({ prompt: wf }), signal: AbortSignal.timeout(30000) });
  if (!q.ok) { console.error(`${key} /prompt ${q.status}: ${(await q.text()).slice(0, 250)}`); return; }
  const { prompt_id } = await q.json();
  for (let i = 0; i < 150; i++) {
    await new Promise((z) => setTimeout(z, 2000));
    const hj = await (await fetch(COMFY + `/history/${prompt_id}`, { headers: H() })).json(); const rec = hj[prompt_id];
    if (rec?.outputs) { for (const o of Object.values(rec.outputs)) for (const im of (o.images || [])) {
      const u = new URLSearchParams({ filename: im.filename, subfolder: im.subfolder || "", type: im.type || "output" });
      fs.writeFileSync(path.join(OUT, `${key}.jpg`), Buffer.from(await (await fetch(COMFY + "/view?" + u, { headers: H() })).arrayBuffer()));
      console.error(`✓ ${key} in ${((Date.now() - t0) / 1000).toFixed(1)}s`); } return; }
    if (rec?.status?.status_str === "error") { console.error(`${key} ERROR`, JSON.stringify(rec.status).slice(0, 300)); return; }
  }
  console.error(`${key} timeout`);
}
await login();
const refName = await upload();
console.error(`FLUX.2 ref-consistency | ref=${REF}`);
for (const k of Object.keys(SCENES)) await gen(k, refName);
console.error("done");
