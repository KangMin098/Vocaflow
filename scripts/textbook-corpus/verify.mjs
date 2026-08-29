// scripts/textbook-corpus/verify.mjs
// 6단계 — 목표 대비 자가 검증. 통과 못 하면 종료코드 1.
//
// 여기서 재는 것은 "돌아갔다" 가 아니라 **목표 6개**다:
//   G1 등재율      원본에 있는 파일이 전부 매니페스트에 있나
//   G2 추출        ok 또는 (명시된) scanned 뿐인가 — 조용한 실패 0
//   G3 분류        6축에 빈 값이 없나
//   G4 조회        FTS·뷰가 실제로 답하나
//   G5 확장성      파일 하나 추가하면 그 하나만 처리하나
//   G6 재실행 안전 두 번 돌려 같은 결과가 나오나
//
//   node verify.mjs             전부
//   node verify.mjs --quick     G5·G6 (느린 것) 빼고

import { DatabaseSync } from 'node:sqlite';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  HERE, ensureDir, hasFlag, loadSources, log, readJson, sha1, slash, storePaths, walk,
} from './lib.mjs';
import { AXES } from './taxonomy.mjs';

const QUICK = hasFlag('--quick');
const src = loadSources();
const sp = storePaths(src.store);
const results = [];

function check(id, name, pass, detail) {
  results.push({ id, name, pass, detail });
  log(`${pass ? '✅' : '❌'} ${id} ${name} — ${detail}`);
}

function node(script, args = [], env = {}) {
  return execFileSync(process.execPath, [path.join(HERE, script), ...args], {
    encoding: 'utf8', env: { ...process.env, ...env },
  });
}

const manifest = readJson(sp.manifest, null);
if (!manifest) { console.error('매니페스트가 없다. 먼저 `node scan.mjs`.'); process.exit(1); }
const docs = Object.values(manifest.docs);

// ── G1 등재율 ──────────────────────────────────────────────────
{
  const roots = [
    ...src.roots.map((r) => r.path),
    ...Object.values(manifest.archives || {}).map((a) => path.join(sp.root, a.target)),
  ];
  const onDisk = new Set();
  for (const r of roots) {
    for (const f of walk(r)) {
      const ext = path.extname(f).toLowerCase();
      if (src.archives.includes(ext)) continue;
      if (!src.include.includes(ext)) continue;
      if (slash(f).startsWith(slash(sp.staging)) && !roots.some((x) => slash(f).startsWith(slash(x)) && slash(x).startsWith(slash(sp.staging)))) continue;
      onDisk.add(slash(f));
    }
  }
  const registered = new Set(docs.map((d) => d.absPath));
  const missing = [...onDisk].filter((f) => !registered.has(f));
  check('G1', '파일 등재율',
    missing.length === 0,
    `디스크 ${onDisk.size} · 등재 ${registered.size} · 누락 ${missing.length}${missing.length ? ` → ${missing.slice(0, 3).join(', ')}` : ''}`);
}

// ── G2 추출 ────────────────────────────────────────────────────
{
  const by = {};
  for (const d of docs) by[d.extract?.status || 'pending'] = (by[d.extract?.status || 'pending'] || 0) + 1;
  const bad = (by.failed || 0) + (by.unsupported || 0) + (by.pending || 0);
  const okPct = ((by.ok || 0) / docs.length) * 100;
  check('G2', '추출 성공률', bad === 0,
    `ok ${by.ok || 0} (${okPct.toFixed(1)}%) · scanned ${by.scanned || 0} · 조용한 실패 ${bad}`);

  // 빈 파일을 "완료" 로 세지 않는지 — ok 인데 문자 0 이면 그게 구멍이다.
  const emptyOk = docs.filter((d) => d.extract?.status === 'ok' && (d.extract?.totals?.chars || 0) === 0);
  check('G2b', 'ok 인데 빈 문서 없음', emptyOk.length === 0,
    emptyOk.length ? emptyOk.map((d) => d.relPath).join(', ') : '0건');
}

// ── G3 분류 ────────────────────────────────────────────────────
{
  const blanks = [];
  for (const d of docs) {
    for (const ax of AXES) {
      if (d[ax] == null || String(d[ax]).trim() === '') blanks.push(`${d.relPath}#${ax}`);
    }
  }
  check('G3', '6축 빈 값 0', blanks.length === 0,
    blanks.length ? blanks.slice(0, 5).join(', ') : `${docs.length}문서 × ${AXES.length}축 모두 채워짐`);

  const low = docs.filter((d) => d.low_confidence?.length);
  check('G3b', '미확정 축 (참고용)', true,
    `${low.length}건 — ${[...new Set(low.flatMap((d) => d.low_confidence))].join(', ') || '없음'} (overrides.json 의 unresolved 에 사유 기록)`);
}

// ── G4 조회 ────────────────────────────────────────────────────
{
  let pass = true; const notes = [];
  try {
    const db = new DatabaseSync(sp.db, { readOnly: true });
    const n = db.prepare('SELECT COUNT(*) c FROM pages').get().c;
    const fts = db.prepare("SELECT COUNT(*) c FROM pages_fts WHERE pages_fts MATCH 'the'").get().c;
    const diff = db.prepare('SELECT COUNT(*) c FROM v_difficulty').get().c;
    const ser = db.prepare('SELECT COUNT(*) c FROM v_series').get().c;
    const gaps = db.prepare('SELECT COUNT(*) c FROM v_gaps').get().c;
    notes.push(`pages ${n} · FTS 히트 ${fts} · v_difficulty ${diff} · v_series ${ser} · v_gaps ${gaps}`);
    pass = n > 0 && fts > 0 && diff > 0 && ser > 0;
    db.close();
  } catch (e) { pass = false; notes.push(String(e).slice(0, 200)); }
  check('G4', '조회 동작', pass, notes.join(' '));
}

// ── G5 확장성 ──────────────────────────────────────────────────
if (!QUICK) {
  const probeRoot = path.join(sp.root, '_verify-root');
  const probeFile = path.join(probeRoot, '새 미리보기 샘플_미리보기.txt');
  const env = { TEXTBOOK_CORPUS_EXTRA_ROOT: `verify=${probeRoot}` };
  let detail = ''; let pass = false;
  try {
    ensureDir(probeRoot);
    fs.writeFileSync(probeFile,
      'Unit 1 The Sample Passage\n\nThis is a short English passage used only to prove that adding one file '
      + 'processes exactly one file. It has enough words to be measured. Reading comprehension improves when '
      + 'learners meet the same words in different contexts over time.\n', 'utf8');

    const scanOut = node('scan.mjs', [], env);
    const added = Number(scanOut.match(/신규 (\d+)/)?.[1] ?? -1);
    const unchanged = Number(scanOut.match(/그대로 (\d+)/)?.[1] ?? -1);
    const exOut = node('extract.mjs', [], env);
    const todo = Number(exOut.match(/처리할 것 (\d+)/)?.[1] ?? -1);
    const anOut = node('analyze.mjs', [], env);
    const analyzed = Number(anOut.match(/분석 (\d+)/)?.[1] ?? -1);

    pass = added === 1 && unchanged === docs.length && todo === 1 && analyzed === 1;
    detail = `신규 ${added} · 그대로 ${unchanged} · 추출 대상 ${todo} · 분석 ${analyzed} (기대: 1 / ${docs.length} / 1 / 1)`;
  } catch (e) {
    detail = String(e).slice(0, 300);
  } finally {
    fs.rmSync(probeRoot, { recursive: true, force: true });
    node('scan.mjs');  // 시험용 문서를 매니페스트에서 뺀다
  }
  check('G5', '파일 1개 추가 = 1개만 처리', pass, detail);
}

// ── G6 재실행 안전 ─────────────────────────────────────────────
if (!QUICK) {
  const d1 = node('build-db.mjs', ['--digest']).trim();
  const d2 = node('build-db.mjs', ['--digest']).trim();
  check('G6a', 'DB 내용 지문 재현', d1 === d2, `${d1.slice(0, 12)} vs ${d2.slice(0, 12)}`);

  const mdDigest = () => {
    node('build-md.mjs');
    const files = walk(sp.md).concat(walk(sp.index)).sort();
    return sha1(files.map((f) => `${slash(path.relative(sp.root, f))}:${sha1(
      // README 의 생성 시각 줄만 뺀다 — 내용이 아니라 시계다.
      fs.readFileSync(f, 'utf8').replace(/^생성 \d{4}-\d{2}-\d{2} [\d:]+ · /m, ''),
    )}`).join('\n'));
  };
  const m1 = mdDigest();
  const m2 = mdDigest();
  check('G6b', 'md 재현', m1 === m2, `${m1.slice(0, 12)} vs ${m2.slice(0, 12)}`);
}

// ── 요약 ──────────────────────────────────────────────────────
const passed = results.filter((r) => r.pass).length;
log(`\n${'─'.repeat(60)}`);
log(`통과 ${passed}/${results.length}`);
if (passed < results.length) {
  log(`실패: ${results.filter((r) => !r.pass).map((r) => r.id).join(', ')}`);
  process.exit(1);
}
