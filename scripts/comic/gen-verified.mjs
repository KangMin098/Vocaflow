// scripts/comic/gen-verified.mjs
// 강제 폐루프(R1 차단): lint → 생성 → 시각 QC → 불합격 자동 재생성 → 전원 PASS 시에만 조립.
// "본 적 없는 패널은 배포하지 않는다"를 코드로 보장한다. 검증 없이는 assemble 이 절대 안 돌아간다.
//
// Usage:
//   node scripts/comic/gen-verified.mjs --script S.json --out OUT \
//     --wf-gen wf/qwen-t2i-from-edit.api.json --wf-edit wf/qwen-edit-lightning.api.json \
//     --user user --pass password [--assemble OUT/comic.html] [--max-rounds 3] [--sdk] [--resume]
//
// 키 있음(--sdk): 완전 자동(생성→SDK 채점→재생성→…→조립).
// 키 없음(기본): 매 라운드 QC 매니페스트에서 멈춤(checkpoint) — Claude(에이전트)가 qc-verdicts.json 을
//   채운 뒤 --resume 로 재호출하면 불합격만 재생성하고 다시 검증. 전원 PASS 라야 조립.
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const HERE = import.meta.dirname;
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); if (i === -1) return d; const v = process.argv[i + 1]; return v && !v.startsWith("--") ? v : true; };
const has = (n) => process.argv.includes(`--${n}`);
const node = process.execPath;
const run = (args, env) => { const r = spawnSync(node, args, { stdio: "inherit", env: { ...process.env, ...env } }); return r.status; };

const SCRIPT = arg("script"), OUT = arg("out");
if (!SCRIPT || !OUT) { console.error("--script 와 --out 필수"); process.exit(2); }
const QCDIR = arg("qc", path.join(OUT, "qc"));
const MAXR = +arg("max-rounds", 3);
const ASSEMBLE = arg("assemble");
const verdictsPath = path.join(QCDIR, "qc-verdicts.json");

// ── 0) LINT 게이트 (생성 전 하드닝 강제) ──
if (!has("resume")) {
  console.log("── [gate] lint ──");
  if (run([path.join(HERE, "lint-script.mjs"), "--script", SCRIPT]) !== 0) {
    console.error("✗ lint BLOCK — 스크립트를 고친 뒤 다시 실행하세요."); process.exit(1);
  }
}

const genArgs = (panels) => {
  const a = [path.join(HERE, "gen-comfy.mjs"), "--script", SCRIPT, "--out", OUT,
    "--wf-gen", arg("wf-gen"), "--wf-edit", arg("wf-edit"),
    "--user", arg("user", "user"), "--pass", arg("pass", "password")];
  if (arg("comfy-url")) { /* COMFY_URL via env */ }
  if (panels) a.push("--panels", panels);
  return a;
};
const qcArgs = () => { const a = [path.join(HERE, "qc-comfy.mjs"), "--script", SCRIPT, "--images", OUT, "--out", QCDIR]; if (has("sdk")) a.push("--sdk"); return a; };
const readVerdicts = () => { try { return JSON.parse(fs.readFileSync(verdictsPath, "utf8")); } catch { return null; } };
const failsOf = (v) => Object.entries(v).filter(([, r]) => r.pass === false).map(([n]) => +n).sort((a, b) => a - b);

let round = 0;
let panels = null; // null = 전체
if (has("resume")) {
  // 이전 라운드 verdicts 소비로 진입
  const v = readVerdicts();
  if (!v) { console.error(`✗ --resume 인데 ${verdictsPath} 없음 — QC 를 먼저 채우세요.`); process.exit(3); }
  panels = failsOf(v).join(",") || null;
}

while (true) {
  round++;
  if (round > MAXR) { console.error(`✗ ${MAXR}라운드 후에도 불합격 잔존 — 사람 개입 필요.`); process.exit(1); }
  console.log(`\n══ round ${round} ══ 생성 ${panels ? "(" + panels + ")" : "(전체)"}`);

  if (!(has("resume") && round === 1 && !panels)) {
    if (run(genArgs(panels), arg("comfy-url") ? { COMFY_URL: arg("comfy-url") } : {}) !== 0) { console.error("✗ 생성 실패"); process.exit(1); }
  }

  console.log("── [gate] vision-QC 매니페스트 ──");
  try { fs.rmSync(verdictsPath, { force: true }); } catch {}
  if (run(qcArgs()) !== 0 && has("sdk")) { console.error("✗ QC 실패"); process.exit(1); }

  const v = readVerdicts();
  if (!v) {
    console.log(`\n⏸ CHECKPOINT — Claude(에이전트)가 ${path.join(QCDIR, "qc-manifest.json")} 의 각 이미지를 열어`);
    console.log(`   ${verdictsPath} 를 채운 뒤:  node scripts/comic/gen-verified.mjs … --resume`);
    console.log("   (검증 전에는 조립하지 않습니다 — R1 강제.)");
    process.exit(20);
  }
  const fails = failsOf(v);
  console.log(`QC: ${Object.keys(v).length - fails.length}/${Object.keys(v).length} pass`);
  if (fails.length === 0) break;
  console.log(`  재생성 대상: ${fails.join(",")}`);
  panels = fails.join(",");
  if (!has("sdk")) {
    console.log(`\n⏸ CHECKPOINT — 위 불합격 패널을 재생성하려면 --resume 로 재호출(자동 재생성 후 다시 검증).`);
    process.exit(21);
  }
}

// ── 전원 PASS → 조립(SHIP) ──
console.log("\n✅ ALL PASS — 조립합니다.");
if (ASSEMBLE) {
  if (run([path.join(HERE, "03-assemble.mjs"), "--script", SCRIPT, "--images", OUT, "--out", ASSEMBLE]) !== 0) { console.error("✗ 조립 실패"); process.exit(1); }
  console.log(`SHIP → ${ASSEMBLE}`);
} else console.log("(--assemble 미지정 — 조립 생략)");
process.exit(0);
