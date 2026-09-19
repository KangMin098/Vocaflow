// scripts/ux-bench/diagnose.mjs
//
// **어디서 점수를 잃는가** — 축 점수만으로는 고칠 곳을 모른다.
//
//   node scripts/ux-bench/diagnose.mjs [--top 12]
//
// 축 평균은 "87.5" 라고만 말한다. 무엇을 고쳐야 87.5 가 94 가 되는지는 말하지 않는다.
// 여기서는 **하위 지표별 손실**(만점 대비 잃은 점수 × 화면 수)을 크기 순으로 낸다 —
// 손실이 큰 것부터 고치는 것이 가장 짧은 길이고, 그 순서는 취향이 아니라 산수다.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreOne } from './score.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'out');
const TOP = Number(process.argv[process.argv.indexOf('--top') + 1]) || 12;

const rows = JSON.parse(fs.readFileSync(path.join(OUT, 'vocaflow.json'), 'utf8'))
  .map((r) => ({ ...r, score: scoreOne(r.raw) }))
  .filter((r) => r.score);

const SUB = {
  design: { D1: '본문 대비 4.5:1', D2: '폰트 크기 종수', D3: '글자색 종수', D4: '4px 간격 그리드' },
  usability: { U1: '터치 타겟 44px', U2: '컨트롤 이름', U3: '가로 넘침', U4: '랜드마크·h1·lang', U5: '제목 계층', U6: '이미지 alt' },
  connectivity: { C1: '막다른 길 아님', C2: '앞길 3종', C3: '셸 링크 3종', C4: '현재 위치 표시' },
  flow: { F1: '첫 화면 행동', F2: 'FCP', F3: 'domInteractive', F4: 'DOM 노드 수' },
};

console.log(`\n측정 ${rows.length}건 (화면 × 뷰포트)\n`);
console.log('═══ 하위 지표별 손실 (만점 대비) ═══');
const losses = [];
for (const [ax, subs] of Object.entries(SUB)) {
  for (const key of Object.keys(subs)) {
    const vals = rows.map((r) => r.score[ax][key]).filter((v) => Number.isFinite(v));
    if (!vals.length) continue;
    const lost = vals.reduce((a, v) => a + (100 - v), 0);
    const worst = rows
      .filter((r) => Number.isFinite(r.score[ax][key]) && r.score[ax][key] < 100)
      .sort((a, b) => a.score[ax][key] - b.score[ax][key])
      .slice(0, 4)
      .map((r) => `${r.url}[${r.viewport}]=${r.score[ax][key]}`);
    losses.push({ ax, key, label: subs[key], n: vals.length, avg: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10, lost: Math.round(lost), worst });
  }
}
for (const l of losses.sort((a, b) => b.lost - a.lost)) {
  if (l.lost === 0) continue;
  console.log(`  ${String(l.lost).padStart(5)}점  ${l.key} ${l.label.padEnd(18)} 평균 ${String(l.avg).padStart(5)} (n=${l.n})`);
  if (l.worst.length) console.log(`             최악: ${l.worst.join(' · ')}`);
}
const clean = losses.filter((l) => l.lost === 0).map((l) => l.key);
if (clean.length) console.log(`\n  손실 0: ${clean.join(' · ')}`);

console.log('\n═══ 화면별 총점 (네 축 평균) 낮은 순 ═══');
const byRoute = rows
  .map((r) => ({
    route: r.url, vp: r.viewport,
    total: Math.round(((r.score.design.score + r.score.usability.score + r.score.connectivity.score + r.score.flow.scoreNeutral) / 4) * 10) / 10,
    d: r.score.design.score, u: r.score.usability.score, c: r.score.connectivity.score, f: r.score.flow.scoreNeutral,
  }))
  .sort((a, b) => a.total - b.total);
for (const r of byRoute.slice(0, TOP)) {
  console.log(`  ${String(r.total).padStart(5)}  ${r.route.padEnd(22)} [${r.vp.padEnd(7)}] D${String(r.d).padStart(5)} U${String(r.u).padStart(5)} C${String(r.c).padStart(5)} F${String(r.f).padStart(5)}`);
}

console.log('\n═══ 원시 값 — 디자인 규율 (종수가 많을수록 시스템 밖) ═══');
for (const r of rows.filter((x) => x.viewport === 'mobile').sort((a, b) => a.score.design.score - b.score.design.score).slice(0, TOP)) {
  const m = r.raw;
  console.log(
    `  D${String(r.score.design.score).padStart(5)}  ${r.url.padEnd(22)} 폰트 ${String(m.fontSizeKinds).padStart(2)}종 · 글자색 ${String(m.textColorKinds).padStart(2)}종` +
      ` · 대비위반 ${m.contrastFail}/${m.textNodes}${m.contrastUnknown ? ` (그라디언트 위 ${m.contrastUnknown}개는 못 잼)` : ''}` +
      ` · 그리드 ${m.spacingOnGrid}/${m.spacingTotal}`,
  );
}

// ── 4px 격자 밖 값이 무엇인가 ──
// "68% 가 격자 밖" 은 고칠 곳을 말해 주지 않는다. **어떤 px 이 몇 번** 나오는지가 말해 준다.
// (Tailwind 의 반 단계 `p-1.5`=6 · `px-3.5`=14 는 토큰 밖이다 — 이 저장소 spacing 은 전부 4의 배수)
const offAll = new Map();
for (const r of rows) for (const o of r.raw.spacingOff ?? []) offAll.set(o.px, (offAll.get(o.px) ?? 0) + o.n);
if (offAll.size) {
  console.log('\n═══ 4px 격자 밖 실제 값 (전 화면 합산) ═══');
  for (const [px, n] of [...offAll.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14)) {
    console.log(`  ${String(px).padStart(6)}px  ${String(n).padStart(5)}회`);
  }
}
