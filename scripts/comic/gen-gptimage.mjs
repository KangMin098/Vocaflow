// scripts/comic/gen-gptimage.mjs
// GPT Image 2 전용 최적화 파이프라인(별도 라인). Qwen/ComfyUI 경로(gen-comfy)와 독립.
// 우리 개선 저작 규약을 GPT Image 2 강점에 맞춰 이식:
//   · 프롬프트 = comic-prompt.mjs(panelPromptText: styleForLevel 잉크 + 시대앵커 + refLines +
//     propLines 소품 상시 + sceneClauses 투명/노화/단일인물 + BLANK/NOTEXT). OpenAI엔 NEG 필드가
//     없으므로 negForLevel 을 "Avoid entirely: …" 절로 프롬프트에 접어 넣는다.
//   · 다중 참조 = GPT Image 2의 핵심 강점. 패널의 모든 캐릭터 참조시트를 한 번에 넣어(≤16장)
//     Bob/Fred/Tim 드리프트·중복을 구조적으로 차단(Qwen 단일참조의 한계 해소).
//   · 텍스트는 굽지 않음(HTML 레터링) → garbled/빈 말풍선 위험 원천 제거.
//
// 두 모드:
//   [sync]  Image API — images.generations(참조시트) + images.edits(패널, 다중참조). 형태 확정·즉시.
//           품질/일관성 검증(A/B)과 소량 교정에 사용. 동시성 풀로 처리량 확보.
//   [batch] Responses API JSONL(/v1/responses, image_generation 툴 + input_image file_id) → /v1/batches.
//           전권(90패널) 50% 할인·24h 비동기. images.edits는 multipart라 배치 불가 → Responses가 유일 경로.
//
// Auth: scripts/comic/.openai-token (gitignored) 또는 env OPENAI_API_KEY. 선불 크레딧 필요.
//
// Usage:
//   node gen-gptimage.mjs --script S.json --out DIR [--panels 6,18] [--refs-only]
//        [--quality high|medium|low] [--size 1024x1536] [--concurrency 4] [--dry-run]
//   node gen-gptimage.mjs --script S.json --out DIR --batch [--responses-model gpt-5.1] [--poll]
import fs from "fs";
import path from "path";
import { refPromptText, panelPromptText, negForLevel, styleForLevel, WEBTOON, REALISTIC, GONICK } from "./comic-prompt.mjs";

const HERE = import.meta.dirname, API = "https://api.openai.com/v1";
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); if (i === -1) return d; const v = process.argv[i + 1]; return v && !v.startsWith("--") ? v : true; };
const has = (n) => process.argv.includes(`--${n}`);

const SCRIPT = arg("script"), OUT = arg("out");
if (!SCRIPT || !OUT) { console.error("--script 와 --out 필수"); process.exit(2); }
const script = JSON.parse(fs.readFileSync(path.isAbsolute(SCRIPT) ? SCRIPT : path.join(process.cwd(), SCRIPT), "utf8"));
const VLEVEL = arg("vlevel") != null && arg("vlevel") !== true ? Number(arg("vlevel")) : (script.adaptation?.target_v_level ?? 6);
const cast = script.cast || [];
const byId = Object.fromEntries(cast.map((c) => [c.id, c]));
const SIZE = arg("size", "1024x1536"); // 세로 2:3 = 만화 패널
const QUALITY = arg("quality", "high");
const CONC = Number(arg("concurrency", 4));
const onlyPanels = arg("panels") ? String(arg("panels")).split(",").map(Number) : null;
const DRY = has("dry-run");
// S2.5 교정 힌트: {panel:{regen_hint}} → 프롬프트에 "IMPORTANT CORRECTION" 으로 주입(재롤 아닌 교정).
const HINTS = (() => { const f = arg("hints"); if (!f || f === true) return {}; try { const v = JSON.parse(fs.readFileSync(f, "utf8")); const o = {}; for (const [k, r] of Object.entries(v)) if (r && r.regen_hint) o[k] = r.regen_hint; return o; } catch { return {}; } })();
const refsDir = path.join(OUT, "refs"); fs.mkdirSync(refsDir, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const KEY = (process.env.OPENAI_API_KEY || (fs.existsSync(path.join(HERE, ".openai-token")) ? fs.readFileSync(path.join(HERE, ".openai-token"), "utf8") : "")).trim();
if (!KEY && !DRY) { console.error("OpenAI 키 없음(.openai-token/OPENAI_API_KEY)"); process.exit(3); }
const AUTH = { Authorization: `Bearer ${KEY}` };

// 화풍: 기본 styleForLevel(레벨별) · --style webtoon → 웹툰 화풍(깨끗·가독·표현력, 저비용 궁합).
const STYLE = { webtoon: WEBTOON, realistic: REALISTIC, gonick: GONICK }[arg("style")] || null;
// NEG(우리 규약)를 OpenAI 프롬프트용 avoid 절로 접어 넣는다(음성 프롬프트 필드 부재).
const AVOID = `Absolutely AVOID and do NOT include: ${negForLevel(VLEVEL, STYLE)}.`;
const NOTXT = "Render NO text, NO words, NO letters, NO speech balloons or callout shapes anywhere — lettering is added later.";
// 스타일 앵커: 하나의 기준 화풍 이미지를 모든 패널의 "마지막 참조"로 고정 → 전권 화풍 균일화(일관성).
const STYLE_REF = arg("style-ref") && arg("style-ref") !== true ? String(arg("style-ref")) : null;
const STYLE_NOTE = STYLE_REF ? " The FINAL reference image defines ONLY the drawing STYLE (line weight, tone, screentone density, overall look) — match that art style EXACTLY across the whole book; do NOT copy its content, characters, poses or composition." : "";
const refPrompt = (c) => `${refPromptText(c, VLEVEL, STYLE)} ${AVOID}`;
const chOf = (p) => (p.characters || []).map((id) => byId[id]).filter(Boolean);
const panelPrompt = (p, chars) => `${panelPromptText(p, chars, { noref: false, vlevel: VLEVEL, style: STYLE })} ${NOTXT}${STYLE_NOTE}${HINTS[p.n] ? ` IMPORTANT CORRECTION: ${HINTS[p.n]}` : ""} ${AVOID}`;
const nnPath = (n) => path.join(OUT, `${String(n).padStart(2, "0")}.jpg`);
const refPath = (id) => path.join(refsDir, `${id}.png`);

async function post(url, body, headers = {}, tries = 3) {
  let last = "";
  for (let a = 0; a < tries; a++) {
    try {
      const r = await fetch(url, { method: "POST", headers: { ...AUTH, ...headers }, body, signal: AbortSignal.timeout(240000) });
      const j = await r.json();
      if (!r.ok) { last = JSON.stringify(j.error || j).slice(0, 300); if (r.status === 429 && /rate/i.test(last)) { await new Promise((z) => setTimeout(z, 8000)); continue; } throw new Error(last); }
      return j;
    } catch (e) { last = e.message; await new Promise((z) => setTimeout(z, 3000)); }
  }
  throw new Error(last || "request failed");
}
const firstB64 = (j) => j?.data?.[0]?.b64_json;

// ── sync: Image API ──
async function genImage(prompt) {
  const j = await post(`${API}/images/generations`, JSON.stringify({ model: "gpt-image-2", prompt, size: SIZE, quality: QUALITY, n: 1 }), { "Content-Type": "application/json" });
  const b = firstB64(j); if (!b) throw new Error("no image"); return Buffer.from(b, "base64");
}
async function editImage(prompt, refPaths) {
  const fd = new FormData();
  fd.append("model", "gpt-image-2"); fd.append("prompt", prompt); fd.append("size", SIZE); fd.append("quality", QUALITY);
  for (const rp of refPaths) fd.append("image[]", new Blob([fs.readFileSync(rp)], { type: "image/png" }), path.basename(rp));
  const j = await post(`${API}/images/edits`, fd);
  const b = firstB64(j); if (!b) throw new Error("no image"); return Buffer.from(b, "base64");
}
async function buildRef(c) {
  const out = refPath(c.id);
  if (fs.existsSync(out) && !has("refs-force")) { console.error(`· ref ${c.id} 있음`); return; }
  if (DRY) { console.error(`[dry] ref ${c.id}: ${refPrompt(c).slice(0, 90)}…`); return; }
  fs.writeFileSync(out, await genImage(refPrompt(c))); console.error(`✓ ref ${c.id}`);
}
async function genPanelSync(p) {
  const chars = chOf(p).filter((c) => fs.existsSync(refPath(c.id)));
  const prompt = panelPrompt(p, chars);
  // 참조 순서: 캐스트(1..N, refLines 대응) → 스타일 앵커(마지막, 화풍 전용).
  const refs = [...chars.map((c) => refPath(c.id)), ...(STYLE_REF && fs.existsSync(STYLE_REF) ? [STYLE_REF] : [])];
  if (DRY) { console.error(`[dry] panel ${p.n} (${chars.map((c) => c.id).join(",") || "noref"}${STYLE_REF ? "+style" : ""}): ${prompt.slice(0, 120)}…`); return; }
  const buf = refs.length ? await editImage(prompt, refs) : await genImage(prompt);
  fs.writeFileSync(nnPath(p.n), buf); console.error(`✓ panel ${p.n} (refs: ${chars.map((c) => c.id).join(",") || "none"}${STYLE_REF ? "+style" : ""})`);
}
// 간단 동시성 풀
async function pool(items, worker, n) {
  const q = [...items]; let ok = 0, fail = 0;
  await Promise.all(Array.from({ length: Math.min(n, q.length) }, async () => {
    while (q.length) { const it = q.shift(); try { await worker(it); ok++; } catch (e) { console.error(`✗ ${it.n ?? it.id}: ${e.message}`); fail++; } }
  }));
  return { ok, fail };
}

// ── batch: Responses JSONL → /v1/batches ──
async function uploadFile(buf, name, purpose) {
  const fd = new FormData(); fd.append("purpose", purpose); fd.append("file", new Blob([buf]), name);
  return post(`${API}/files`, fd);
}
function responsesBody(p, fileIds) {
  const chars = chOf(p);
  const content = [{ type: "input_text", text: panelPrompt(p, chars.filter((c) => fileIds[c.id])) }];
  for (const c of chars) if (fileIds[c.id]) content.push({ type: "input_image", file_id: fileIds[c.id] });
  return { model: arg("responses-model", "gpt-5.1"), input: [{ role: "user", content }], tools: [{ type: "image_generation", quality: QUALITY, size: SIZE }] };
}
async function runBatch(panels) {
  // 1) 참조시트 확보 + Files 업로드(input_image 는 file_id 필요)
  for (const c of cast) await buildRef(c);
  const fileIds = {};
  if (!DRY) for (const c of cast) if (fs.existsSync(refPath(c.id))) { const f = await uploadFile(fs.readFileSync(refPath(c.id)), `${c.id}.png`, "vision"); fileIds[c.id] = f.id; console.error(`· up ${c.id} → ${f.id}`); }
  // 2) JSONL 작성
  const lines = panels.map((p) => JSON.stringify({ custom_id: `panel-${p.n}`, method: "POST", url: "/v1/responses", body: responsesBody(p, fileIds) }));
  const jsonlPath = path.join(OUT, "batch-requests.jsonl"); fs.writeFileSync(jsonlPath, lines.join("\n") + "\n");
  console.error(`JSONL → ${jsonlPath} (${lines.length} panels)`);
  if (DRY) { console.error("[dry] 배치 제출 생략. JSONL 만 검증."); return; }
  // 3) 업로드 → 배치 생성
  const inFile = await uploadFile(fs.readFileSync(jsonlPath), "batch-requests.jsonl", "batch");
  const batch = await post(`${API}/batches`, JSON.stringify({ input_file_id: inFile.id, endpoint: "/v1/responses", completion_window: "24h" }), { "Content-Type": "application/json" });
  fs.writeFileSync(path.join(OUT, "batch.json"), JSON.stringify(batch, null, 2));
  console.error(`✓ batch ${batch.id} status=${batch.status} — 24h 창. 회수: node gen-gptimage.mjs … --collect ${batch.id}`);
}
async function collectBatch(id) {
  const b = await (await fetch(`${API}/batches/${id}`, { headers: AUTH })).json();
  console.error(`batch ${id} status=${b.status}`);
  if (b.status !== "completed") { console.error("아직 미완료 — 나중에 다시 --collect."); return; }
  const txt = await (await fetch(`${API}/files/${b.output_file_id}/content`, { headers: AUTH })).text();
  let ok = 0;
  for (const line of txt.split("\n").filter(Boolean)) {
    const r = JSON.parse(line); const n = Number(String(r.custom_id).replace("panel-", ""));
    const out = r.response?.body?.output || [];
    const img = out.find((o) => o.type === "image_generation_call");
    const b64 = img?.result; if (!b64) { console.error(`✗ panel ${n}: 이미지 없음`); continue; }
    fs.writeFileSync(nnPath(n), Buffer.from(b64, "base64")); ok++; console.error(`✓ panel ${n}`);
  }
  console.error(`\n회수 ${ok} 패널 → ${OUT}`);
}

// ── main ──
const panels = [...script.panels].sort((a, b) => a.n - b.n).filter((p) => !onlyPanels || onlyPanels.includes(p.n));
console.error(`GPT Image 2 | V${VLEVEL} ${(STYLE && STYLE.register) || styleForLevel(VLEVEL).register} | ${SIZE} ${QUALITY} | ${panels.length} panels | mode=${has("batch") ? "batch" : has("collect") ? "collect" : "sync"}${DRY ? " [dry-run]" : ""}`);

if (has("collect")) { await collectBatch(arg("collect")); }
else if (has("batch")) { await runBatch(panels); }
else {
  for (const c of cast) await buildRef(c);
  if (has("refs-only")) { console.error("refs-only 완료"); process.exit(0); }
  const { ok, fail } = await pool(panels, genPanelSync, CONC);
  console.error(`\ndone — ${ok} panels, ${fail} failed`);
}
