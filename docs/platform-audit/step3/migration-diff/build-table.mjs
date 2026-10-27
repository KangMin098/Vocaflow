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
for (const f of readdirSync(join(repo, 'supabase', 'migrations'))) {
  const m = /^(\d+)_(.+)\.sql$/.exec(f);
  if (!m) continue;
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
const c = { shiftedDb: 0, shiftedFile: 0, matched: 0, nameDiff: 0, dbOnly: 0, mainOnly: 0, dupFile: 0 };
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
  } else if (fn.some((n) => dbNames.has(n))) { status = 'MAIN_ONLY_SHIFTED'; c.shiftedFile++; } else { status = 'MAIN_ONLY'; c.mainOnly++; }
  rows.push(`| ${v} | ${dn ?? ''} | ${fn.join(' / ')} | ${status} | ${src} |`);
}

const md = [
  '# T-0002 migration reconciliation table (generated)',
  '',
  `DB rows: ${db.size} · main files: ${[...files.values()].flat().length} (distinct versions ${files.size})`,
  '',
  `MATCH ${c.matched} · DB_ONLY_SHIFTED ${c.shiftedDb} · MAIN_ONLY_SHIFTED ${c.shiftedFile} · NAME_DIFF ${c.nameDiff} · DB_ONLY ${c.dbOnly} · MAIN_ONLY ${c.mainOnly} · versions with >1 main file ${c.dupFile}`,
  '',
  '| version | DB name | main file name(s) | status | source branch (DB_ONLY) |',
  '|---|---|---|---|---|',
  ...rows,
  '',
].join('\n');
writeFileSync(join(here, 'TABLE.md'), md);
console.log(JSON.stringify(c), db.size, files.size);
