// scripts/comic/repair-loop.mjs
// R21 검증-게이트형 교정 = 수렴 엔진. "재생성만" 하는 whack-a-mole 을 "재생성+재검증+동결"로.
// 실패 패널마다: best-of-N 후보 생성 → 각 후보 재검증 → 통과분만 채택(원본 덮어씀)·동결.
// ≤K 라운드 후에도 실패면 사람 플래그(무한루프 대신). 통과 패널은 다시 건드리지 않는다.
//
// Usage:
//   node repair-loop.mjs --script S.json --out OUT --wf-gen G --wf-edit E --user u --pass p \
//     --comfy-url URL --panels 6,10,16 --hints OUT/qc/round2-hints.json [--n 3] [--k 2] [--sdk]
//     [--adopt OUT/qc/repair-picks.json]
// --sdk(+ANTHROPIC_API_KEY): 후보 검증·채택 자동. 없으면: 후보 생성 후 candidates.json 을 쓰고 멈춤 →
//   Claude(에이전트)가 각 패널의 통과 후보 경로를 repair-picks.json 에 적고 --adopt 로 재호출하면 채택.
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { styleForLevel } from "./comic-prompt.mjs";
const HERE = import.meta.dirname, node = process.execPath;
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); if (i === -1) return d; const v = process.argv[i + 1]; return v && !v.startsWith("--") ? v : true; };
const has = (n) => process.argv.includes(`--${n}`);
const SCRIPT = arg("script"), OUT = arg("out");
if (!SCRIPT || !OUT) { console.error("--script, --out 필수"); process.exit(2); }
const PANELS = String(arg("panels", "")).split(",").filter(Boolean).map(Number);
const N = +arg("n", 3), K = +arg("k", 2);
const QC = path.join(OUT, "qc"); fs.mkdirSync(path.join(QC, "cand"), { recursive: true });
const script = JSON.parse(fs.readFileSync(path.isAbsolute(SCRIPT) ? SCRIPT : path.join(process.cwd(), SCRIPT), "utf8"));
const tier = script.adaptation?.default_tier || "teen";
const vlevel = script.adaptation?.target_v_level ?? 6;
const register = styleForLevel(vlevel).register;
const byId = Object.fromEntries((script.cast || []).map((c) => [c.id, c]));
const panelSpec = (n) => { const p = (script.panels || []).find((x) => x.n === n) || {}; const t = p.text?.[tier] || {}; return { n, scene: p.scene, characters: (p.characters || []).map((id) => byId[id]?.anchor).filter(Boolean), narration: t.narration || "", captions: (t.bubbles || []).map((b) => (b.speaker ? b.speaker + ": " : "") + b.text) }; };
const cand = (n, r, j) => path.join(QC, "cand", `p${n}-r${r}-c${j}.jpg`);
const nnPath = (n) => path.join(OUT, `${String(n).padStart(2, "0")}.jpg`);

// ── ADOPT phase: agent 가 고른 후보를 채택 ──
if (has("adopt")) {
  const picks = JSON.parse(fs.readFileSync(arg("adopt"), "utf8"));
  let ok = 0, flagged = [];
  for (const [n, pk] of Object.entries(picks)) {
    if (pk && pk.pick && pk.pick !== "none" && fs.existsSync(pk.pick)) { fs.copyFileSync(pk.pick, nnPath(n)); console.log(`✓ adopt p${n} ← ${path.basename(pk.pick)}`); ok++; }
    else { console.log(`⚑ flag p${n} — 통과 후보 없음(사람 확인)`); flagged.push(+n); }
  }
  console.log(`\n채택 ${ok} · 플래그 ${flagged.length}${flagged.length ? " [" + flagged.join(",") + "]" : ""}`);
  process.exit(flagged.length ? 1 : 0);
}

const genArgs = (n) => [path.join(HERE, "gen-comfy.mjs"), "--script", SCRIPT, "--out", OUT, "--wf-gen", arg("wf-gen"), "--wf-edit", arg("wf-edit"), "--user", arg("user", "user"), "--pass", arg("pass", "password"), "--panels", String(n), "--suffix", "-cand", ...(arg("hints") ? ["--hints", arg("hints")] : [])];
const env = arg("comfy-url") ? { ...process.env, COMFY_URL: arg("comfy-url") } : process.env;
function makeCandidate(n, r, j) { // gen-comfy writes OUT/NN-cand.jpg (random seed) → move to cand path
  const st = spawnSync(node, genArgs(n), { stdio: "inherit", env }).status;
  const src = path.join(OUT, `${String(n).padStart(2, "0")}-cand.jpg`);
  if (st !== 0 || !fs.existsSync(src)) return null;
  const dst = cand(n, r, j); fs.renameSync(src, dst); return dst;
}

const RUBRIC = `이 책 레지스터="${register}"(V${vlevel}). hard-fail: baked_text(철자오류/판독가능 글자; 단 철자정확 고유명사 묘비는 허용), empty_balloon, colour_leak(흑백 책에 색), no_background, wrong/duplicate/floating-head, identity_collapse(faceless 유령은 후드 안 순흑void 필수), text_image_mismatch, anachronism(1843), deformity. 사실적 해칭/스크린톤은 이 레지스터에서 정상(결함 아님).`;

// ── 후보 생성 + (sdk면) 검증·채택 / (아니면) 후보 매니페스트 ──
const candManifest = {}, accepted = [], flagged = [];
let client = null;
if (has("sdk")) { try { const A = (await import("@anthropic-ai/sdk")).default; if (!process.env.ANTHROPIC_API_KEY) throw 0; client = new A(); } catch { console.error("--sdk 인데 sdk/key 없음 — key 없이 에이전트 경로로 진행"); } }

for (const n of PANELS) {
  const spec = panelSpec(n);
  let done = false;
  for (let r = 1; r <= K && !done; r++) {
    const cands = [];
    for (let j = 1; j <= N; j++) { const c = makeCandidate(n, r, j); if (c) cands.push(c); }
    if (!cands.length) { console.error(`p${n} r${r}: 후보 생성 실패`); continue; }
    if (client) { // 자동 검증: 통과 후보 채택
      for (const c of cands) {
        const b64 = fs.readFileSync(c).toString("base64");
        const msg = await client.messages.create({ model: "claude-opus-4-8", max_tokens: 300, messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } }, { type: "text", text: `${RUBRIC}\n패널 ${n} spec: scene=${spec.scene}; captions=${JSON.stringify(spec.captions)}; chars=${JSON.stringify(spec.characters)}\nONLY JSON: {"pass":bool,"reason":""}` }] }] });
        let v; try { v = JSON.parse(msg.content.map((x) => x.text || "").join("").match(/\{[\s\S]*\}/)[0]); } catch { v = { pass: false }; }
        console.log(`p${n} r${r} ${path.basename(c)}: ${v.pass ? "PASS" : "fail " + (v.reason || "")}`);
        if (v.pass) { fs.copyFileSync(c, nnPath(n)); accepted.push(n); done = true; break; }
      }
    } else { candManifest[n] = { spec, candidates: cands }; done = true; } // 에이전트 경로: 후보만 모아두고 다음 패널
  }
  if (!done && client) { flagged.push(n); console.log(`⚑ p${n}: ${K}라운드 후 통과 후보 없음 — 사람 플래그`); }
}

if (client) {
  fs.writeFileSync(path.join(QC, "repair-report.json"), JSON.stringify({ accepted, flagged, register }, null, 2));
  console.log(`\n채택 ${accepted.length} · 플래그 ${flagged.length}${flagged.length ? " [" + flagged.join(",") + "]" : ""}`);
  process.exit(flagged.length ? 1 : 0);
} else {
  fs.writeFileSync(path.join(QC, "repair-candidates.json"), JSON.stringify({ rubric: RUBRIC, instruction: "각 패널의 후보 이미지를 열어 rubric 대비 통과하는 것을 고르고 repair-picks.json 에 {panel:{pick:'통과 후보 경로 또는 none'}} 로 기록 → node repair-loop.mjs … --adopt <OUT>/qc/repair-picks.json", panels: candManifest }, null, 2));
  console.log(`\n후보 생성 완료 → ${path.join(QC, "repair-candidates.json")}`);
  console.log(`다음: Claude 에이전트가 통과 후보를 골라 repair-picks.json 작성 → --adopt 로 채택.`);
}
