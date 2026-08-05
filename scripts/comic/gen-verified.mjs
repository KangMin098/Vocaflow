// scripts/comic/gen-verified.mjs
// 자립형 폐루프 오케스트레이터 — Claude 판단을 "필요한 위치마다" 박아 효율·품질을 동시에.
//   S0   lint (하드닝 강제, deterministic)
//   S0.5 preflight (생성 전 text↔scene 정합 — GPU 낭비 사전 차단)   ← Claude
//   S1   생성 (gen-comfy)
//   S2   패널 QC 게이트 (hard-fail)                                  ← Claude
//   S2.5 교정 재생성 (regen_hint 를 프롬프트에 주입, 재롤 아님)        ← 코드
//   S3   교차 캐릭터 일관성 (T2)                                      ← Claude
//   S4   전원 PASS → 조립(SHIP). 검증 없이는 조립 안 함(R1 강제).
//
// 키 있음(--sdk + ANTHROPIC_API_KEY): 완전 자동(end-to-end).
// 키 없음: 각 Claude 스테이지에서 매니페스트를 쓰고 멈춤(checkpoint) → Claude(에이전트)가
//   해당 verdicts.json 을 채운 뒤 --resume 로 재호출하면 이어서 자동 진행.
//
// Usage:
//   node gen-verified.mjs --script S.json --out OUT --wf-gen G --wf-edit E \
//     --user user --pass password [--comfy-url URL] [--assemble OUT/comic.html] [--sdk] [--resume] [--max-rounds 3]
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
const HERE = import.meta.dirname, node = process.execPath;
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); if (i === -1) return d; const v = process.argv[i + 1]; return v && !v.startsWith("--") ? v : true; };
const has = (n) => process.argv.includes(`--${n}`);
const SDK = has("sdk") ? ["--sdk"] : [];
const run = (args, env) => spawnSync(node, args, { stdio: "inherit", env: { ...process.env, ...env } }).status;
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };

const SCRIPT = arg("script"), OUT = arg("out");
if (!SCRIPT || !OUT) { console.error("--script, --out 필수"); process.exit(2); }
const QC = arg("qc", path.join(OUT, "qc")); fs.mkdirSync(QC, { recursive: true });
const MAXR = +arg("max-rounds", 3), ASSEMBLE = arg("assemble");
const S = (f) => path.join(HERE, f);
const genArgs = (panels, hints) => { const a = [S("gen-comfy.mjs"), "--script", SCRIPT, "--out", OUT, "--wf-gen", arg("wf-gen"), "--wf-edit", arg("wf-edit"), "--user", arg("user", "user"), "--pass", arg("pass", "password")]; if (panels) a.push("--panels", panels); if (hints) a.push("--hints", hints); return a; };
const env = arg("comfy-url") ? { COMFY_URL: arg("comfy-url") } : {};

// Claude 스테이지 실행기: 매니페스트 생성(+--sdk 자동채점) → verdicts 있으면 consume, 없으면 checkpoint.
function claudeStage(label, manifestArgs, verdictsFile, consumeArgs) {
  console.log(`\n── [${label}] ──`);
  run(manifestArgs.concat(SDK), env);
  if (!fs.existsSync(path.join(QC, verdictsFile))) {
    console.log(`\n⏸ CHECKPOINT(${label}) — Claude 에이전트가 ${path.join(QC, verdictsFile.replace("verdicts", "manifest"))} 를 보고`);
    console.log(`   ${path.join(QC, verdictsFile)} 를 채운 뒤:  node scripts/comic/gen-verified.mjs … --resume`);
    process.exit(20);
  }
  return run(consumeArgs); // exit code: 0 pass, 1 fail(=재생성 필요)
}

// ── S0 lint ──
if (!has("resume")) { console.log("── [S0 lint] ──"); if (run([S("lint-script.mjs"), "--script", SCRIPT]) !== 0) { console.error("✗ lint BLOCK"); process.exit(1); } }

// ── S0.5 preflight (생성 전) ──
if (!has("resume") || !readJson(path.join(OUT, ".gv-past-preflight"))) {
  const st = claudeStage("S0.5 preflight", [S("preflight.mjs"), "--script", SCRIPT, "--out", QC], "preflight-verdicts.json", [S("preflight.mjs"), "--verdicts", QC]);
  if (st !== 0) { console.error("✗ preflight BLOCK — scene/caption 정합을 고친 뒤 다시(생성 안 함)"); process.exit(1); }
  fs.writeFileSync(path.join(OUT, ".gv-past-preflight"), "1");
}

// ── S1~S3 라운드 루프 ──
const hintsPath = path.join(QC, "qc-verdicts.json");
let panels = null, round = 0;
if (has("resume")) { const v = readJson(hintsPath); if (v) panels = Object.entries(v).filter(([, r]) => r.pass === false).map(([n]) => +n).sort((a, b) => a - b).join(",") || null; }
while (true) {
  if (++round > MAXR) { console.error(`✗ ${MAXR}라운드 후 잔존 결함 — 사람 개입`); process.exit(1); }
  console.log(`\n══ round ${round} — 생성 ${panels ? "(" + panels + ")" : "(전체)"} ══`);
  // --resume 로 들어와 이미 전체 생성돼 있으면(1라운드·특정패널 아님) 생성 스킵하고 QC 부터
  if (!(has("resume") && round === 1 && panels === null && fs.existsSync(path.join(OUT, "18.jpg")))) {
    if (run(genArgs(panels, fs.existsSync(hintsPath) ? hintsPath : null), env) !== 0) { console.error("✗ 생성 실패"); process.exit(1); }
  }
  try { fs.rmSync(hintsPath, { force: true }); } catch {}
  // S2 패널 QC
  const st2 = claudeStage("S2 패널 QC", [S("qc-comfy.mjs"), "--script", SCRIPT, "--images", OUT, "--out", QC], "qc-verdicts.json", [S("qc-comfy.mjs"), "--verdicts", QC]);
  if (st2 !== 0) { const v = readJson(hintsPath); panels = Object.entries(v).filter(([, r]) => r.pass === false).map(([n]) => +n).sort((a, b) => a - b).join(","); console.log(`  S2 실패 → 교정 재생성 ${panels}`); continue; }
  // S3 교차 일관성
  const st3 = claudeStage("S3 교차 일관성", [S("qc-cross.mjs"), "--script", SCRIPT, "--images", OUT, "--out", QC], "cross-verdicts.json", [S("qc-cross.mjs"), "--verdicts", QC]);
  if (st3 !== 0) { const cv = readJson(path.join(QC, "cross-verdicts.json")); const set = new Set(); for (const r of Object.values(cv)) if (r.consistent === false) (r.regen_panels || []).forEach((n) => set.add(n)); panels = [...set].sort((a, b) => a - b).join(","); console.log(`  S3 드리프트 → 재생성 ${panels}`); continue; }
  break;
}

// ── S4 SHIP ──
console.log("\n✅ ALL PASS (preflight+S2+S3) — 조립합니다.");
try { fs.rmSync(path.join(OUT, ".gv-past-preflight"), { force: true }); } catch {}
if (ASSEMBLE) { if (run([S("03-assemble.mjs"), "--script", SCRIPT, "--images", OUT, "--out", ASSEMBLE]) !== 0) { console.error("✗ 조립 실패"); process.exit(1); } console.log(`SHIP → ${ASSEMBLE}`); }
else console.log("(--assemble 미지정)");
process.exit(0);
