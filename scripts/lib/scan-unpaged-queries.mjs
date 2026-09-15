// scripts/lib/scan-unpaged-queries.mjs
//
// **PostgREST 1000행 상한에 걸릴 수 있는 조회를 찾는다.**
//
// ── 왜 필요한가 (실측 2026-08-30) ───────────────────────────────────
// 이 저장소는 같은 함정에 **네 번** 걸렸다. 마지막 것이 가장 컸다 —
// `store-new-types.mjs` 가 원글을 페이징 없이 읽어 **3,356편 중 981편(29%)만**
// 보고 있었고, 그 탓에 낡음 판정이 실행마다 흔들렸으며 규격 밖 문항 2,886건이
// "낡음 0건" 으로 보고됐다. 같은 파일 아래쪽에는 그 경고가 **이미 적혀 있었다.**
//
// 주석으로는 못 막는다. 그래서 기계가 훑는다.
//
// ── 무엇을 의심하는가 ────────────────────────────────────────────────
// `.from(t).select(...)` 한 덩어리 안에 다음이 **하나도** 없으면 의심한다:
//   · `.range(`        — 직접 페이징
//   · `.limit(n)` (n ≤ 1000) — 상한을 알고 자른 것
//   · `.single()` `.maybeSingle()` — 한 행만
//   · `count: 'exact', head: true` — 개수만
//   · `fetchAllIn(` 로 감싼 호출 — 공용 페이저
//
// 판정은 **후보**다. 표가 작으면 문제가 아니다 — 그래서 표 이름과 함께 낸다.
//
// 재실행 안전: 읽기만 한다.
// 실행: node scripts/lib/scan-unpaged-queries.mjs [--json]

import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['scripts', 'apps/web/src', 'packages'];
const EXT = new Set(['.ts', '.tsx', '.mjs', '.mts', '.js']);
const SKIP = /node_modules|\.next|dist|build|__tests__|\.test\.|\.spec\./;

/** 한 조회 덩어리를 이 길이까지 이어 붙여 본다 — 체이닝이 여러 줄에 걸친다. */
const CHAIN_CHARS = 700;

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (SKIP.test(full)) continue;
    if (e.isDirectory()) walk(full, out);
    else if (e.isFile() && EXT.has(path.extname(e.name))) out.push(full);
  }
  return out;
}

/** 체인에 페이징·상한 장치가 있나. */
function isGuarded(chain) {
  if (/\.range\s*\(/.test(chain)) return 'range';
  if (/\.single\s*\(\s*\)/.test(chain)) return 'single';
  if (/\.maybeSingle\s*\(\s*\)/.test(chain)) return 'maybeSingle';
  if (/head\s*:\s*true/.test(chain)) return 'head-count';
  const lim = chain.match(/\.limit\s*\(\s*(\d+)\s*\)/);
  if (lim && Number(lim[1]) <= 1000) return `limit(${lim[1]})`;
  if (lim) return `limit(${lim[1]})>1000`;   // 상한을 넘겨 적은 것 — 서버가 1000에서 자른다
  return null;
}

/**
 * 1000행을 넘길 수 있는 표 — `pg_stat_user_tables` 실측(2026-08-30).
 * 작은 표를 페이징 없이 읽는 것은 결함이 아니다. 여기 있는 것만 위험하다.
 */
const BIG_TABLES = {
  library_article_vocabularies: 1672358,
  shared_words: 664216,
  csat_dcp_items: 136533,
  topic_word_stats: 100261,
  topic_corpus_queue: 97212,
  shared_dictionary: 48969,
  pending_words: 26322,
  proper_noun_forms: 24300,
  shared_word_sets: 11131,
  topic_corpus_docs: 7712,
  library_articles: 6633,
  library_chapter_quiz: 1340,
}

/**
 * 결과를 확실히 좁히는 필터 — 있으면 1000행을 넘길 일이 거의 없다.
 * `.in(...)` 은 배열 크기에 따라 다르므로 좁힘으로 보지 않는다.
 */
function narrowing(chain) {
  const eqs = [...chain.matchAll(/\.eq\s*\(\s*['"`]([\w.]+)['"`]/g)].map((m) => m[1]);
  const idish = eqs.filter((c) => /(^|_)id$|^id$|_key$|^word$|^slug$/.test(c));
  return idish.length > 0 ? `eq(${idish.join(',')})` : null;
}

const files = ROOTS.flatMap((r) => walk(r));
const suspects = [];
const guarded = [];

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  // `fetchAllIn(` 로 감싼 호출은 공용 페이저를 탄다.
  const lines = src.split('\n');

  for (const m of src.matchAll(/\.from\s*\(\s*['"`]([\w.]+)['"`]\s*\)/g)) {
    const at = m.index ?? 0;
    const chain = src.slice(at, at + CHAIN_CHARS);
    // 같은 체인 안에서 select 가 나오지 않으면 조회가 아니다(insert/update/delete).
    const head = chain.slice(0, 200);
    if (!/\.select\s*\(/.test(head)) continue;
    if (/\.(insert|update|upsert|delete)\s*\(/.test(head)) continue;

    const line = src.slice(0, at).split('\n').length;
    // 앞 3줄 안에 fetchAllIn 이 있으면 공용 페이저를 탄다.
    const before = lines.slice(Math.max(0, line - 4), line).join(' ');
    // 공용 페이저로 감싼 호출은 `range()` 가 그 안에 있어 체인에는 안 보인다.
    const viaM = before.match(/(fetchAllIn|fetchAllPaged)\s*\(/);
    const via = viaM ? viaM[1] : null;

    const guard = via ?? isGuarded(chain);
    const rows = BIG_TABLES[m[1]] ?? 0;
    const narrow = narrowing(chain);
    const rec = { file: file.split(path.sep).join('/'), line, table: m[1], guard, rows, narrow };
    const safe = (guard && !String(guard).endsWith('>1000')) || !!narrow || rows === 0;
    if (safe) guarded.push(rec);
    else suspects.push(rec);
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ suspects, guardedCount: guarded.length }, null, 2));
} else {
  console.log(`훑은 파일 ${files.length} · 조회 ${suspects.length + guarded.length}`);
  console.log(`  장치 있음 ${guarded.length} · **의심 ${suspects.length}**\n`);
  const byTable = {};
  for (const s of suspects) (byTable[s.table] ??= []).push(s);
  for (const [table, rows] of Object.entries(byTable).sort((a, b) => (BIG_TABLES[b[0]] ?? 0) - (BIG_TABLES[a[0]] ?? 0))) {
    console.log(`  ${table}  ${(BIG_TABLES[table] ?? 0).toLocaleString()}행  — 의심 ${rows.length}`);
    for (const r of rows) console.log(`      ${r.file}:${r.line}${r.guard ? `  [${r.guard}]` : ''}`);
  }
  console.log('\n  ⚠️ 의심은 판정이 아니다 — 표가 1000행 미만이면 문제가 없다.');
  console.log('     표 크기를 확인한 뒤 큰 표를 읽는 것부터 고칠 것.');
}
