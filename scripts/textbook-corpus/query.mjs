// scripts/textbook-corpus/query.mjs
// 조회 CLI — DB 를 열지 않고도 코퍼스를 물어본다.
//
//   node query.mjs stats
//   node query.mjs search "artificial intelligence" [--limit 10] [--school 고등] [--series 천일문]
//   node query.mjs doc <doc_id> [--from 1] [--to 5]
//   node query.mjs series [이름조각]
//   node query.mjs difficulty
//   node query.mjs gaps
//   node query.mjs word <낱말>          어느 학년대 교재에 나오는지
//   node query.mjs sql "SELECT ..."

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { flagValue, loadSources, storePaths } from './lib.mjs';

const src = loadSources();
const sp = storePaths(src.store);
if (!fs.existsSync(sp.db)) {
  console.error(`DB 가 없다: ${sp.db}\n먼저 \`node build-db.mjs\`.`);
  process.exit(1);
}
const db = new DatabaseSync(sp.db, { readOnly: true });

function printTable(rows) {
  if (!rows.length) { console.log('(결과 없음)'); return; }
  const cols = Object.keys(rows[0]);
  const w = cols.map((c) => Math.max(
    c.length,
    ...rows.map((r) => String(r[c] ?? '').replace(/\n/g, ' ').length),
  ));
  const cap = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n));
  const width = cols.map((c, i) => Math.min(w[i], c === 'text' || c === 'snippet' ? 90 : 40));
  console.log(cols.map((c, i) => cap(c, width[i])).join('  '));
  console.log(width.map((n) => '─'.repeat(n)).join('  '));
  for (const r of rows) {
    console.log(cols.map((c, i) => cap(String(r[c] ?? '').replace(/\s+/g, ' '), width[i])).join('  '));
  }
  console.log(`\n${rows.length}행`);
}

const [cmd, ...rest] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const argIsFlagValue = new Set([
  flagValue('--limit'), flagValue('--school'), flagValue('--series'),
  flagValue('--from'), flagValue('--to'),
].filter(Boolean));
const positional = rest.filter((a) => !argIsFlagValue.has(a));
const arg = positional[0];
const LIMIT = Number(flagValue('--limit', '20')) || 20;

switch (cmd) {
  case 'stats': {
    console.log('== 전체 ==');
    printTable(db.prepare(`SELECT
      (SELECT COUNT(*) FROM docs) AS 문서,
      (SELECT COUNT(*) FROM pages) AS 쪽,
      (SELECT SUM(chars) FROM docs) AS 문자,
      (SELECT COUNT(*) FROM docs WHERE status='ok') AS 추출성공,
      (SELECT COUNT(*) FROM docs WHERE status='scanned') AS 스캔본,
      (SELECT COUNT(*) FROM docs WHERE low_confidence<>'') AS 분류미확정`).all());
    console.log('\n== 학교급 ==');
    printTable(db.prepare(`SELECT school AS 학교급, COUNT(*) AS 문서, SUM(pages) AS 쪽,
      ROUND(AVG(fk_grade),2) AS FK평균 FROM docs GROUP BY school ORDER BY MIN(grade_min)`).all());
    console.log('\n== 유형 ==');
    printTable(db.prepare('SELECT category AS 유형, COUNT(*) AS 문서, SUM(pages) AS 쪽 FROM docs GROUP BY category ORDER BY 2 DESC').all());
    console.log('\n== 역할 ==');
    printTable(db.prepare('SELECT role AS 역할, COUNT(*) AS 문서 FROM docs GROUP BY role ORDER BY 2 DESC').all());
    break;
  }
  case 'search': {
    if (!arg) { console.error('검색어가 필요하다.'); process.exit(1); }
    const school = flagValue('--school');
    const series = flagValue('--series');
    const rows = db.prepare(`
      SELECT d.grade_band AS 학년대, d.series AS 시리즈, d.role AS 역할, f.p AS 쪽,
             snippet(pages_fts, 0, '«', '»', '…', 14) AS snippet, f.doc_id AS doc_id
      FROM pages_fts f JOIN docs d ON d.id = f.doc_id
      WHERE pages_fts MATCH ?
        ${school ? 'AND d.school LIKE ?' : ''}
        ${series ? 'AND d.series LIKE ?' : ''}
      ORDER BY d.grade_min, d.series, f.p
      LIMIT ?`).all(...[arg, school ? `%${school}%` : null, series ? `%${series}%` : null, LIMIT].filter((x) => x !== null));
    printTable(rows);
    break;
  }
  case 'doc': {
    if (!arg) { console.error('doc_id 가 필요하다.'); process.exit(1); }
    const d = db.prepare('SELECT * FROM docs WHERE id = ? OR file_name LIKE ?').get(arg, `%${arg}%`);
    if (!d) { console.error('그런 문서가 없다.'); process.exit(1); }
    for (const [k, v] of Object.entries(d)) {
      if (v === null || v === '' || k === 'abs_path') continue;
      console.log(`${k.padEnd(15)} ${v}`);
    }
    const from = Number(flagValue('--from', '1'));
    const to = Number(flagValue('--to', String(from + 2)));
    console.log(`\n── ${from}–${to}쪽 ──`);
    for (const p of db.prepare('SELECT p, text FROM pages WHERE doc_id=? AND p BETWEEN ? AND ? ORDER BY p').all(d.id, from, to)) {
      console.log(`\n[${p.p}쪽]\n${p.text}`);
    }
    break;
  }
  case 'series': {
    printTable(arg
      ? db.prepare('SELECT * FROM v_series WHERE series LIKE ?').all(`%${arg}%`)
      : db.prepare('SELECT * FROM v_series').all());
    break;
  }
  case 'difficulty':
    printTable(db.prepare('SELECT * FROM v_difficulty').all());
    break;
  case 'gaps':
    printTable(db.prepare('SELECT * FROM v_gaps').all());
    break;
  case 'word': {
    if (!arg) { console.error('낱말이 필요하다.'); process.exit(1); }
    printTable(db.prepare(`
      SELECT d.grade_band AS 학년대, d.series AS 시리즈, d.role AS 역할, t.n AS 횟수, t.rank AS 순위
      FROM top_words t JOIN docs d ON d.id = t.doc_id
      WHERE t.word = ? ORDER BY d.grade_min, t.n DESC`).all(arg.toLowerCase()));
    break;
  }
  case 'sql':
    printTable(db.prepare(arg).all());
    break;
  default:
    console.log(fs.readFileSync(new URL(import.meta.url), 'utf8')
      .split('\n').filter((l) => l.startsWith('//')).slice(1, 14).map((l) => l.slice(3)).join('\n'));
}
db.close();
