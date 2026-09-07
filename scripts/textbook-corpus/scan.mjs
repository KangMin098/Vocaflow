// scripts/textbook-corpus/scan.mjs
// 1단계 — 원본 스캔 · 압축 전개 · 매니페스트 작성.
//
// 재실행 안전: 이미 등재된 문서는 내용 해시가 같으면 건드리지 않는다.
// 압축파일도 해시로 전개 여부를 판단하므로 328MB zip 을 매번 풀지 않는다.
//
//   node scan.mjs            평소 실행
//   node scan.mjs --force    전개·해시 강제 재계산

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  HERE, docId, ensureDir, fileHash, fmtBytes, hasFlag, loadSources, log,
  readJson, safeSlug, slash, storePaths, walk, writeJson,
} from './lib.mjs';
import { applyOverrides, classify } from './taxonomy.mjs';

const FORCE = hasFlag('--force');

function expandArchives(src, sp, archiveState) {
  const found = [];
  for (const root of src.roots) {
    for (const file of walk(root.path)) {
      const ext = path.extname(file).toLowerCase();
      if (!src.archives.includes(ext)) continue;
      const rel = slash(path.relative(root.path, file));
      const key = `${root.id}:${rel}`;
      const hash = fileHash(file);
      const target = path.join(sp.staging, root.id, safeSlug(path.basename(file)));

      if (!FORCE && archiveState[key]?.hash === hash && fs.existsSync(target)) {
        found.push({ key, target, rootId: root.id, rel, skipped: true });
        continue;
      }
      log(`  전개 ${rel} (${fmtBytes(fs.statSync(file).size)}) …`);
      ensureDir(target);
      execFileSync('unzip', ['-o', '-q', file, '-d', target], { stdio: 'inherit' });
      archiveState[key] = { hash, target: slash(path.relative(sp.root, target)), extractedAt: new Date().toISOString() };
      found.push({ key, target, rootId: root.id, rel, skipped: false });
    }
  }
  return found;
}

function main() {
  const src = loadSources();
  const sp = storePaths(src.store);
  ensureDir(sp.root);
  ensureDir(sp.staging);

  const overrides = readJson(path.join(HERE, 'overrides.json'), null);
  const prev = readJson(sp.manifest, { version: 1, docs: {}, archives: {} });
  const archives = prev.archives || {};

  log('== 1) 압축 전개 ==');
  const archiveDirs = expandArchives(src, sp, archives);
  for (const a of archiveDirs) log(`  ${a.skipped ? '건너뜀' : '전개됨'}  ${a.rel}`);

  // 스캔 대상 = 원본 root + 전개된 staging 디렉터리. staging 은 자기 root 로 취급해
  // 압축 안쪽 경로가 그대로 상대경로가 되게 한다.
  const scanRoots = [
    ...src.roots.map((r) => ({
      id: r.id, path: r.path, label: r.label, origin: 'root',
      // root 별 제외 규칙. 같은 문서의 다른 표현(추출 .txt · zip 사본)을 함께 넣으면
      // 지문이 두 번 세어져 시장 규격이 기운다 — 그건 조용히 틀리는 종류의 오류다.
      exclude: (r.exclude ?? []).map((x) => new RegExp(x)),
    })),
    ...archiveDirs.map((a) => ({
      id: `${a.rootId}#${safeSlug(path.basename(a.rel))}`,
      path: a.target,
      label: `압축 ${a.rel}`,
      origin: 'archive',
      archiveKey: a.key,
    })),
  ];

  log('== 2) 파일 스캔 ==');
  const docs = {};
  let added = 0; let unchanged = 0; let changed = 0;

  for (const r of scanRoots) {
    for (const file of walk(r.path)) {
      const ext = path.extname(file).toLowerCase();
      if (src.archives.includes(ext)) continue;      // 압축 자체는 문서가 아니다
      if (!src.include.includes(ext)) continue;
      if (r.origin === 'root' && slash(file).includes(slash(sp.staging))) continue;

      const rel = slash(path.relative(r.path, file));
      if (r.exclude?.some((re) => re.test(rel))) continue;
      const id = docId(r.id, rel);
      const stat = fs.statSync(file);
      const before = prev.docs?.[id];
      const hash = (!FORCE && before && before.size === stat.size && before.mtimeMs === stat.mtimeMs)
        ? before.hash
        : fileHash(file);

      const fileName = path.basename(file);
      const axes = applyOverrides(classify({ relPath: rel, fileName }), { relPath: rel }, overrides);

      docs[id] = {
        id,
        root: r.id,
        rootLabel: r.label,
        origin: r.origin,
        archiveKey: r.archiveKey || null,
        relPath: rel,
        absPath: slash(file),
        fileName,
        ext: ext.replace('.', ''),
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        hash,
        ...axes,
        // 추출·분석 상태는 뒷 단계 소관 — 기존 값을 보존하되 내용이 바뀌면 무효화한다.
        // 여기서 떨어뜨리면 파일 하나만 추가해도 79건이 전부 다시 돈다.
        extract: before && before.hash === hash ? before.extract || null : null,
        analysis: before && before.hash === hash ? before.analysis || null : null,
        firstSeen: before?.firstSeen || new Date().toISOString(),
      };

      if (!before) added += 1;
      else if (before.hash !== hash) changed += 1;
      else unchanged += 1;
    }
  }

  const removed = Object.keys(prev.docs || {}).filter((id) => !docs[id]);

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    store: sp.root,
    sources: src.roots,
    archives,
    counts: {
      total: Object.keys(docs).length,
      added, changed, unchanged, removed: removed.length,
    },
    docs,
  };
  writeJson(sp.manifest, manifest);

  log('== 3) 결과 ==');
  log(`  문서 ${manifest.counts.total}  (신규 ${added} · 변경 ${changed} · 그대로 ${unchanged} · 사라짐 ${removed.length})`);
  const byExt = {};
  for (const d of Object.values(docs)) byExt[d.ext] = (byExt[d.ext] || 0) + 1;
  log(`  확장자: ${Object.entries(byExt).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  const totalBytes = Object.values(docs).reduce((a, d) => a + d.size, 0);
  log(`  용량 합계 ${fmtBytes(totalBytes)}`);
  const lowConf = Object.values(docs).filter((d) => d.low_confidence.length > 0);
  log(`  저신뢰 분류 ${lowConf.length} 건`);
  for (const d of lowConf) log(`    - [${d.low_confidence.join(',')}] ${d.relPath}`);
  log(`\n  매니페스트: ${sp.manifest}`);
}

main();
