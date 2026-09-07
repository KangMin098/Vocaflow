// scripts/ux-bench/compare.mjs
//
// **판정** — 축마다 `Vocaflow / 대표 플랫폼 최고값 ≥ 1.05` 인가.
//
//   node scripts/ux-bench/compare.mjs
//
// ── "105% 우위" 를 어떻게 셈했나 ──────────────────────────────────────
// 비교 상대를 **평균**으로 잡으면 쉬운 목표가 된다(못하는 곳이 끌어내린다).
// 그래서 축마다 **가장 잘한 플랫폼**을 상대로 둔다. 즉
//     우위비 = Vocaflow축점수 ÷ max(플랫폼별 축점수)
// 이고, 목표는 그 값이 1.05 이상.
//
// ⚠️ **산술적 상한을 숨기지 않는다.** 점수는 100점 만점이므로, 상대가 95.3점을
//    넘는 축에서는 우리가 만점을 받아도 1.05 가 나오지 않는다. 그런 축은
//    `capped` 로 표시하고, 그때의 실질 목표는 **만점 + 결함 0** 이다.
//    (달성 불가능한 목표를 달성했다고 적는 것이 이 저장소가 가장 경계하는 실패다.)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AXES, AXIS_KO, aggregate, scoreOne } from './score.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'out');
/**
 * **점수는 저장된 값을 믿지 않고 원시 측정에서 다시 낸다.**
 *
 * 실측 2026-08-25: 채점식에 항목을 하나 더했더니, 그 전에 잰 파일에는 그 항목이 없어
 * 축 하나가 통째로 "측정 부족" 으로 빠졌다. 측정은 비싸고(브라우저 수십 분) 채점은 싸다 —
 * 둘을 붙여 두면 채점을 고칠 때마다 다시 재야 한다. 여기서 떼어 놓는다.
 */
const load = (f) => {
  const p = path.join(OUT, f);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf8')).map((r) => ({ ...r, score: scoreOne(r.raw) }));
};

const comp = load('competitors.json');
const self = load('vocaflow.json');
const TARGET_RATIO = 1.05;

/**
 * 플랫폼별 축 점수 — **화면마다 회차 중앙값을 먼저 낸 뒤** 그 값들을 평균한다.
 *
 * ⚠️ 회차를 그냥 다 섞어 평균하면 한 번의 이상치가 기준선을 끌고 간다.
 *    실측 2026-08-25: 같은 커밋 두 실행 사이 LingQ 디자인 88.4 ↔ 74.4.
 *    라이브 사이트는 방문마다 다른 화면(A/B·쿠키 배너·광고)을 준다.
 *    중앙값은 그 한 번을 흡수하고, 평균은 흡수하지 못한다.
 */
function byPlatform(rows) {
  const median = (xs) => {
    const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
    if (!v.length) return null;
    const mid = v.length >> 1;
    return v.length % 2 ? v[mid] : Math.round(((v[mid - 1] + v[mid]) / 2) * 10) / 10;
  };
  // ① 화면(플랫폼+주소+뷰포트)별로 회차를 모은다
  const byScreen = new Map();
  for (const r of rows) {
    if (!r.score) continue;
    const key = `${r.platform}|${r.url}|${r.viewport}`;
    if (!byScreen.has(key)) byScreen.set(key, { platform: r.platform, region: r.region, runs: [] });
    byScreen.get(key).runs.push(r.score);
  }
  // ② 화면마다 축별 중앙값 → 그 화면의 대표 점수
  const byPlat = new Map();
  for (const { platform, region, runs } of byScreen.values()) {
    const rep = {
      design: { score: median(runs.map((s) => s.design.score)) },
      usability: { score: median(runs.map((s) => s.usability.score)) },
      connectivity: { score: median(runs.map((s) => s.connectivity.score)) },
      flow: {
        score: median(runs.map((s) => s.flow.score)),
        scoreNeutral: median(runs.map((s) => s.flow.scoreNeutral)),
      },
    };
    if (!byPlat.has(platform)) byPlat.set(platform, { region, screens: [] });
    byPlat.get(platform).screens.push(rep);
  }
  // ③ 플랫폼별 평균 (화면 수가 다른 것은 평균이 흡수한다)
  const out = [];
  for (const [platform, { region, screens }] of byPlat) {
    out.push({ platform, region, n: screens.length, ...aggregate(screens) });
  }
  return out.sort((a, b) => a.platform.localeCompare(b.platform));
}

const compRows = byPlatform(comp);
const selfRows = byPlatform(self);
const mine = selfRows[0];

const failed = comp.filter((r) => !r.score);
const selfFailed = self.filter((r) => !r.score);

console.log('\n═══ 대표 플랫폼 (공개 학습 표면) ═══');
console.log(
  '플랫폼'.padEnd(16) + '지역'.padEnd(8) + '화면'.padStart(4) +
    AXES.map((a) => AXIS_KO[a].padStart(8)).join(''),
);
for (const r of compRows) {
  console.log(
    r.platform.padEnd(16) + String(r.region).padEnd(8) + String(r.n).padStart(4) +
      AXES.map((a) => String(r[a] ?? '–').padStart(8)).join(''),
  );
}
if (failed.length) {
  console.log(`\n  못 잰 측정 ${failed.length}건 (분모에서 제외 — 점수 0 으로 세지 않는다):`);
  for (const f of failed) console.log(`    ${f.platform} [${f.viewport}] ${String(f.raw?.error).slice(0, 60)}  ${f.url}`);
}

if (!mine) {
  console.log('\n⚠️ Vocaflow 측정이 없다 — `--target vocaflow` 를 먼저 돌릴 것.');
  process.exit(0);
}

console.log('\n═══ Vocaflow ═══');
console.log(
  'Vocaflow'.padEnd(16) + 'self'.padEnd(8) + String(mine.n).padStart(4) +
    AXES.map((a) => String(mine[a] ?? '–').padStart(8)).join(''),
);
if (selfFailed.length) {
  console.log(`\n  못 잰 화면 ${selfFailed.length}건:`);
  for (const f of selfFailed.slice(0, 12)) console.log(`    ${f.url} [${f.viewport}] ${String(f.raw?.error).slice(0, 60)}`);
}

console.log('\n═══ 판정 (목표 105%) ═══');
// `flowNeutral` = 속도 둘(FCP·domInteractive)을 뺀 흐름 점수.
// 우리는 localhost, 상대는 공용 인터넷에서 잰다 — 그 차이로 생긴 우위는 제품의 것이 아니다.
// **판정은 중립값으로** 하고 원래 값은 참고로 함께 찍는다.
const AXIS_KEY = { design: 'design', usability: 'usability', connectivity: 'connectivity', flow: 'flowNeutral' };
const verdict = [];
for (const axName of AXES) {
  const ax = AXIS_KEY[axName];
  const vals = compRows.map((r) => ({ platform: r.platform, v: r[ax] })).filter((x) => Number.isFinite(x.v));
  if (!vals.length || !Number.isFinite(mine[ax])) {
    console.log(`${AXIS_KO[axName].padEnd(6)} 측정 부족 — 판정 보류`);
    verdict.push({ axis: axName, ratio: null });
    continue;
  }
  const best = vals.reduce((a, b) => (b.v > a.v ? b : a));
  const avg = Math.round((vals.reduce((s, x) => s + x.v, 0) / vals.length) * 10) / 10;
  const ratio = Math.round((mine[ax] / best.v) * 1000) / 10;
  const capped = best.v * TARGET_RATIO > 100;
  const pass = ratio >= TARGET_RATIO * 100;
  console.log(
    `${AXIS_KO[axName].padEnd(6)} 우리 ${String(mine[ax]).padStart(5)} · 최고 ${String(best.v).padStart(5)}(${best.platform}) · 평균 ${String(avg).padStart(5)}` +
      ` → ${String(ratio).padStart(6)}%  ${pass ? '✅' : '❌'}` +
      (capped ? `  ⚠️상한 — 최고 ${best.v} 상대로는 만점이어도 ${Math.round((100 / best.v) * 1000) / 10}% 가 최대` : ''),
  );
  verdict.push({ axis: axName, key: ax, mine: mine[ax], best: best.v, bestPlatform: best.platform, avg, ratio, capped, pass });
}
console.log(
  `\n참고 · 속도 포함 흐름 점수(환경 편향 있음 — 우리 localhost vs 상대 공용 인터넷):` +
    ` 우리 ${mine.flow} · 상대 최고 ${Math.max(...compRows.map((r) => r.flow ?? 0))}`,
);

const done = verdict.filter((v) => v.pass).length;
const judged = verdict.filter((v) => v.ratio !== null).length;
console.log(`\n달성률: ${judged ? Math.round((done / judged) * 1000) / 10 : 0}%  (근거: ${done}/${judged} 축이 105% 이상)`);
fs.writeFileSync(path.join(OUT, 'verdict.json'), JSON.stringify({ compRows, selfRows, verdict }, null, 2), 'utf8');
