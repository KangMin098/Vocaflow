// scripts/textbook-corpus/overlap.mjs
// 4b단계 — 문서 간 지문 겹침 산출.
//
// 이 코퍼스에는 같은 책이 여러 본 들어 있다 — 스캔본과 텍스트본, 미리보기와 정답해설,
// `빠바 구문독해_미리보기` 와 `2.빠른독해 바른독해_구문독해` 처럼 이름만 다른 사본까지.
// 무엇이 무엇의 사본인지 모르면 "교재 N종을 비교했다" 는 말이 거짓이 된다.
//
// 재는 값은 **포함률(containment)** 이다. 자카드는 20쪽 미리보기와 207쪽 본책을
// 남남으로 만든다 — 작은 쪽이 큰 쪽에 얼마나 들어 있는지를 물어야 맞다.
//
//   node overlap.mjs             결과를 store/overlap.json 에
//   node overlap.mjs --min 0.15  보고 임계값 (기본 0.10)

import path from 'node:path';
import {
  flagValue, loadSources, log, readJson, storePaths, writeJson,
} from './lib.mjs';

/** 작은 쪽이 큰 쪽에 얼마나 들어 있나. 두 sketch 는 오름차순 정렬돼 있다. */
function containment(a, b) {
  let i = 0; let j = 0; let hit = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { hit += 1; i += 1; j += 1; }
    else if (a[i] < b[j]) i += 1;
    else j += 1;
  }
  const small = Math.min(a.length, b.length);
  return { containment: small ? hit / small : 0, shared: hit, jaccard: (a.length + b.length - hit) ? hit / (a.length + b.length - hit) : 0 };
}

function main() {
  const src = loadSources();
  const sp = storePaths(src.store);
  const manifest = readJson(sp.manifest, null);
  if (!manifest) { console.error('매니페스트가 없다. 먼저 `node scan.mjs`.'); process.exit(1); }
  const MIN = Number(flagValue('--min', '0.10'));

  const docs = Object.values(manifest.docs)
    .filter((d) => Array.isArray(d.analysis?.sketch) && d.analysis.sketch.length >= 20)
    .sort((a, b) => a.id.localeCompare(b.id));
  log(`비교 대상 ${docs.length} 문서 (지문 20개 이상)`);

  const pairs = [];
  for (let i = 0; i < docs.length; i += 1) {
    for (let j = i + 1; j < docs.length; j += 1) {
      const r = containment(docs[i].analysis.sketch, docs[j].analysis.sketch);
      if (r.containment < MIN) continue;
      // 작은 쪽을 a 로 둔다 — "a 가 b 안에 들어 있다" 로 읽힌다.
      const [a, b] = docs[i].analysis.sketch.length <= docs[j].analysis.sketch.length
        ? [docs[i], docs[j]] : [docs[j], docs[i]];
      pairs.push({
        a: a.id, aName: a.fileName, aSeries: a.series, aRole: a.role, aPages: a.extract?.pages || 0,
        b: b.id, bName: b.fileName, bSeries: b.series, bRole: b.role, bPages: b.extract?.pages || 0,
        sameSeries: a.series === b.series,
        containment: Number(r.containment.toFixed(4)),
        jaccard: Number(r.jaccard.toFixed(4)),
        shared: r.shared,
        // 판정: 거의 같은 책 / 한쪽이 다른 쪽의 부분(미리보기·해설) / 지문 일부 공유
        verdict: r.jaccard >= 0.6 ? '같은 책(중복 보관)'
          : r.containment >= 0.6 ? '부분본 (미리보기·해설 등)'
            : '지문 일부 공유',
      });
    }
  }
  pairs.sort((x, y) => y.containment - x.containment);

  writeJson(path.join(sp.root, 'overlap.json'), {
    generatedAt: new Date().toISOString(),
    minContainment: MIN,
    compared: docs.length,
    pairs,
  });

  const byVerdict = {};
  for (const p of pairs) byVerdict[p.verdict] = (byVerdict[p.verdict] || 0) + 1;
  log(`겹침 쌍 ${pairs.length} — ${Object.entries(byVerdict).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  for (const p of pairs.filter((x) => x.verdict !== '지문 일부 공유').slice(0, 20)) {
    log(`  ${(p.containment * 100).toFixed(0)}% [${p.verdict}] ${p.aName} ⊂ ${p.bName}`);
  }
}

main();
