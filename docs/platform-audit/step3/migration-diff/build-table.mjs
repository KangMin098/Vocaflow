// docs/platform-audit/step3/migration-diff/build-table.mjs
// T-0002 read-only reconciliation: dev DB schema_migrations vs supabase/migrations on this checkout.
// Usage: node build-table.mjs <db-dump.txt>   (dump = "version|name,version|name,..." from
//   select string_agg(version||'|'||coalesce(name,''), ',' order by version) from supabase_migrations.schema_migrations)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..', '..');
const dump = readFileSync(process.argv[2], 'utf8').trim();

const db = new Map();
for (const pair of dump.split(',')) {
  const i = pair.indexOf('|');
  db.set(pair.slice(0, i), pair.slice(i + 1));
}

const files = new Map();
const skipped = [];
const fileOf = new Map();
const objResult = process.argv[3] ? JSON.parse(readFileSync(process.argv[3], 'utf8')) : {};
const objReq = {};
function createdObjects(v, n) {
  const sql = readFileSync(join(repo, 'supabase', 'migrations', fileOf.get(`${v}_${n}`)), 'utf8');
  const out = [];
  for (const mm of sql.matchAll(/create\s+(?:or\s+replace\s+)?(table|function|view|materialized\s+view)\s+(?:if\s+not\s+exists\s+)?((?:"?[a-z_0-9]+"?\.)?"?[a-z_0-9]+"?)/gi)) {
    const kind = /function/i.test(mm[1]) ? 'function' : 'relation';
    let name = mm[2].replace(/"/g, '').toLowerCase();
    if (!name.includes('.')) name = 'public.' + name;
    out.push(`${kind}:${name}`);
  }
  return [...new Set(out)];
}
for (const f of readdirSync(join(repo, 'supabase', 'migrations'))) {
  // forms on main: 14-digit `YYYYMMDDHHMMSS_name.sql` and `YYYYMMDD_HHMMSS_name.sql`; `_pending_*.sql` is skipped
  let m = /^(\d{14})_(.+)\.sql$/.exec(f);
  const m86 = m ? null : /^(\d{8})_(\d{6})_(.+)\.sql$/.exec(f);
  if (m86) m = [f, m86[1] + m86[2], m86[3]];
  if (!m) { skipped.push(f); continue; }
  fileOf.set(`${m[1]}_${m[2]}`, f);
  if (!files.has(m[1])) files.set(m[1], []);
  files.get(m[1]).push(m[2]);
}

function branchesFor(version) {
  const out = execFileSync('git', ['-C', repo, 'log', '--all', '--format=%H', '--name-only', '--', `supabase/migrations/${version}_*`], { encoding: 'utf8' });
  const commits = out.split('\n').filter((l) => /^[0-9a-f]{40}$/.test(l));
  const names = new Set();
  for (const l of out.split('\n')) {
    const m = /supabase\/migrations\/(\d+)_(.+)\.sql$/.exec(l);
    if (m && m[1] === version) names.add(m[2]);
  }
  if (!commits.length) return { refs: [], names: [] };
  const first = commits[commits.length - 1];
  const refs = execFileSync('git', ['-C', repo, 'branch', '-a', '--contains', commits[0], '--format=%(refname:short)'], { encoding: 'utf8' })
    .split('\n').map((s) => s.trim()).filter(Boolean);
  return { refs, names: [...names], first: first.slice(0, 9), last: commits[0].slice(0, 9) };
}

const fileByName = new Map();
for (const [v, ns] of files) for (const n of ns) { if (!fileByName.has(n)) fileByName.set(n, []); fileByName.get(n).push(v); }
const dbNames = new Set(db.values());
const versions = [...new Set([...db.keys(), ...files.keys()])].sort();
const rows = [];
const c = { moPresent: 0, moAbsent: 0, moPartial: 0, moNoObj: 0, shiftedDb: 0, shiftedFile: 0, matched: 0, nameDiff: 0, dbOnly: 0, mainOnly: 0, dupFile: 0 };
for (const v of versions) {
  const dn = db.get(v);
  const fn = files.get(v) || [];
  let status, src = '';
  if (fn.length > 1) c.dupFile++;
  if (dn !== undefined && fn.length) {
    if (fn.includes(dn)) { status = 'MATCH'; c.matched++; }
    else { status = 'NAME_DIFF'; c.nameDiff++; }
  } else if (dn !== undefined) {
    const alt = (fileByName.get(dn) || []).filter((x) => !db.has(x));
    if (alt.length) { status = 'DB_ONLY_SHIFTED'; c.shiftedDb++; src = `same name on main as ${alt.join('/')}`; }
    else { status = 'DB_ONLY'; c.dbOnly++;
    const b = branchesFor(v);
    src = b.refs.length ? `${b.refs.slice(0, 4).join(' ')}${b.refs.length > 4 ? ` (+${b.refs.length - 4})` : ''} [file: ${b.names.join('/')}; commit ${b.last}]` : (b.names.length ? `unreachable-by-branch [file: ${b.names.join('/')}]` : 'none (no file in any git ref)'); }
  } else if (fn.some((n) => dbNames.has(n))) { status = 'MAIN_ONLY_SHIFTED'; c.shiftedFile++; } else { status = 'MAIN_ONLY'; c.mainOnly++;
    const objs = fn.flatMap((n) => createdObjects(v, n));
    for (const o of objs) objReq[o] = true;
    if (!objs.length) { src = 'no CREATE TABLE/FUNCTION/VIEW (unchecked)'; c.moNoObj++; }
    else if (!Object.keys(objResult).length) src = `objects: ${objs.join(', ')}`;
    else { const present = objs.filter((o) => objResult[o]); const absent = objs.filter((o) => !objResult[o]);
      if (!absent.length) { src = `object present (likely applied under other version/name): ${objs.join(', ')}`; c.moPresent++; }
      else if (!present.length) { src = `object absent: ${absent.join(', ')}`; c.moAbsent++; }
      else { src = `partial — present: ${present.join(', ')}; absent: ${absent.join(', ')}`; c.moPartial++; } } }
  rows.push(`| ${v} | ${dn ?? ''} | ${fn.join(' / ')} | ${status} | ${src} |`);
}

const md = [
  '# T-0002 migration reconciliation table (generated)',
  '',
  `DB rows: ${db.size} · main files: ${[...files.values()].flat().length} (distinct versions ${files.size})`,
  '',
  `MATCH ${c.matched} · DB_ONLY_SHIFTED ${c.shiftedDb} · MAIN_ONLY_SHIFTED ${c.shiftedFile} · NAME_DIFF ${c.nameDiff} · DB_ONLY ${c.dbOnly} · MAIN_ONLY ${c.mainOnly} · versions with >1 main file ${c.dupFile}`,
  '',
  `MAIN_ONLY object check: present ${c.moPresent} · absent ${c.moAbsent} · partial ${c.moPartial} · no-create ${c.moNoObj}`,
  '',
  `Skipped non-version files (${skipped.length}): ${skipped.join(', ')}`,
  '',
  '| version | DB name | main file name(s) | status | source branch (DB_ONLY) / object check (MAIN_ONLY) |',
  '|---|---|---|---|---|',
  ...rows,
  '',
].join('\n');
writeFileSync(join(here, 'TABLE.md'), md);
if (!process.argv[3]) console.log(JSON.stringify(Object.keys(objReq)));
console.log(JSON.stringify(c), db.size, files.size);
