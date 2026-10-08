// scripts/csat/map/gen-find-tasks.mjs
//
// FIND 과제 보강(2026-10-07) — source/find-tasks-20261007.json(정본) → 검증 · 기존 162 과제와 겹침 점검 · 시드 SQL · 되돌리기 SQL · learning-map.json 반영.
// 검증: 대상 라인 = 「찾기 과제 없는 라인」 정확히 20개(prescription.ts 기준) · 라인당 하나 · 다음 단계(next)가 실제 과제 id · 필드 비어 있지 않음.
// 겹침: 제목+방법의 글자 2-gram Jaccard — 같은 라인 기존 과제와 0.35 이상이면 멈춘다(다시 쓴다), 전체 최댓값은 출력.
//   node scripts/csat/map/gen-find-tasks.mjs            # 검증 · 겹침 표 · SQL 파일 생성(DB 접속 없음)
//   node scripts/csat/map/gen-find-tasks.mjs --write-source   # 검증 뒤 learning-map.json 의 라인 과제에 ord 4 로 더한다(재실행 안전)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const SRC = path.join(ROOT, 'scripts/csat/map/source/find-tasks-20261007.json')
const MAP = path.join(ROOT, 'scripts/csat/map/source/learning-map.json')
const STAGE = path.join(ROOT, 'apps/web/src/lib/csat/map/prescription.ts')
const SQL = path.join(ROOT, 'scripts/db/seed-20261007-find-tasks.sql')
const RB = path.join(ROOT, 'scripts/db/rollback-seed-20261007-find-tasks.sql')

const find = JSON.parse(fs.readFileSync(SRC, 'utf8'))
const map = JSON.parse(fs.readFileSync(MAP, 'utf8'))
const stageSrc = fs.readFileSync(STAGE, 'utf8')
// 기존 162 과제 단계(새 FIND 는 아직 없다고 보고 원래 ord 1–3 만 센다)
const stage = Object.fromEntries([...stageSrc.matchAll(/'([A-J]\d+-[1-3])': '(\w+)'/g)].map((m) => [m[1], m[2]]))
const lines = [...new Set(Object.keys(stage).map((id) => id.split('-')[0]))]
const noFind = lines.filter((l) => ![1, 2, 3].some((o) => stage[`${l}-${o}`] === 'FIND'))
const fail = (m) => { console.error('중단:', m); process.exit(1) }

if (Object.keys(stage).length !== 162) fail(`기존 대응표가 162 가 아니다(${Object.keys(stage).length})`)
const got = find.tasks.map((t) => t.line)
if (new Set(got).size !== got.length) fail('한 라인에 두 개')
const want = new Set(noFind)
if (got.length !== want.size || got.some((l) => !want.has(l))) fail(`대상 라인 불일치 — 필요 ${[...want].join(' ')} / 받음 ${got.join(' ')}`)
for (const t of find.tasks) {
  for (const k of ['title', 'how', 'cadence', 'doneWhen', 'material', 'purpose', 'signal']) if (!String(t[k] ?? '').trim()) fail(`${t.line} ${k} 비어 있음`)
  if (!['past', 'core'].includes(t.material)) fail(`${t.line} material`)
  const nx = Object.values(t.next ?? {})
  if (nx.length < 2) fail(`${t.line} 다음 단계 갈래가 두 개 미만`)
  for (const id of nx) if (!stage[id]) fail(`${t.line} 다음 단계 ${id} 가 없는 과제`)
  if (/숙달|취약|양호|달성|병목/.test(t.title + t.how + t.doneWhen)) fail(`${t.line} 판정 금지어`)
}

// 겹침 — 글자 2-gram Jaccard
const grams = (s) => { const x = s.replace(/\s+/g, ''); const g = new Set(); for (let i = 0; i < x.length - 1; i++) g.add(x.slice(i, i + 2)); return g }
const jac = (a, b) => { let n = 0; for (const g of a) if (b.has(g)) n++; return n / (a.size + b.size - n || 1) }
const existing = Object.entries(map.tasks).flatMap(([line, ts]) => ts.filter((t) => t.ord <= 3).map((t) => ({ id: `${line}-${t.ord}`, line, g: grams(t.title + t.how) })))
const rows = []
let worst = { s: 0 }
for (const t of find.tasks) {
  const g = grams(t.title + t.how)
  let best = { s: 0, id: '' }
  let sameLine = 0
  for (const e of existing) {
    const s = jac(g, e.g)
    if (s > best.s) best = { s, id: e.id }
    if (e.line === t.line) sameLine = Math.max(sameLine, s)
  }
  if (sameLine >= 0.35) fail(`${t.line} 같은 라인 기존 과제와 겹침 ${sameLine.toFixed(2)}`)
  if (best.s > worst.s) worst = { s: best.s, line: t.line, id: best.id }
  rows.push({ line: t.line, title: t.title, sameLine: sameLine.toFixed(2), nearest: `${best.id} ${best.s.toFixed(2)}` })
}
console.table(rows)
console.log(`가장 가까운 기존 과제: ${worst.line} ↔ ${worst.id} (${worst.s.toFixed(2)}) — 같은 라인 기준 0.35 미만이면 통과`)

const lit = (s) => (s === null ? 'null' : `'${String(s).replace(/'/g, "''")}'`)
const values = find.tasks.map((t) => `  (${lit(`${t.line}-${find.ord}`)}, ${lit(t.line)}, ${find.ord}, ${lit(t.title)}, ${lit(t.how)}, ${lit(t.cadence)}, ${lit(t.doneWhen)}, ${lit(t.material)}, null)`)
const ids = find.tasks.map((t) => lit(`${t.line}-${find.ord}`)).join(', ')
fs.writeFileSync(SQL, `-- scripts/db/seed-20261007-find-tasks.sql
--
-- 학습 지도 FIND(찾기) 과제 보강 — 찾기 과제가 없던 라인 20개에 ord ${find.ord} 하나씩(과제 162 → 182). 생성: scripts/csat/map/gen-find-tasks.mjs
-- 정본: scripts/csat/map/source/find-tasks-20261007.json(목적 · 관찰 신호 · 다음 단계 포함). 스키마 변경 없음 · 데이터만.
-- FIND = 연습 과제가 아니라 어디서 실패하는지 가르는 짧은 진단 활동(LEARNING_MAP_VNEXT §14). 진단 전 화면에서 「지금 해 볼 수 있는」 단계.
-- 안전: 이미 있는 id 는 건드리지 않는다(ON CONFLICT DO NOTHING) · 끝에서 182 · 라인 54 를 확인하고 아니면 전체를 되돌린다.
-- 되돌리기: scripts/db/rollback-seed-20261007-find-tasks.sql
begin;
insert into public.csat_map_task (id, line_code, ord, title, how, cadence, done_when, material, method_line) values
${values.join(',\n')}
on conflict (id) do nothing;
do $$
declare n int; nl int;
begin
  select count(*), count(distinct line_code) into n, nl from public.csat_map_task;
  if n <> 182 or nl <> 54 then raise exception 'FIND 보강 뒤 과제 % · 라인 % — 기대 182 · 54', n, nl; end if;
end $$;
commit;
`)
fs.writeFileSync(RB, `-- scripts/db/rollback-seed-20261007-find-tasks.sql — FIND 과제 20개를 지운다(완료 기록이 있으면 멈춘다 — 학습자 기록을 지우지 않는다).
begin;
do $$ begin
  if exists (select 1 from public.csat_map_task_done where task_id in (${ids})) then
    raise exception 'FIND 과제 완료 기록이 있다 — 되돌리지 않는다';
  end if;
end $$;
delete from public.csat_map_task where id in (${ids});
commit;
`)
console.log('생성:', path.relative(ROOT, SQL), path.relative(ROOT, RB))

if (process.argv.includes('--write-source')) {
  for (const t of find.tasks) {
    const list = map.tasks[t.line]
    if (!list) fail(`learning-map.json 에 ${t.line} 과제 목록 없음`)
    const row = { ord: find.ord, title: t.title, how: t.how, cadence: t.cadence, doneWhen: t.doneWhen, material: t.material, methodLine: null }
    const i = list.findIndex((x) => x.ord === find.ord)
    if (i >= 0) list[i] = row
    else list.push(row)
  }
  fs.writeFileSync(MAP, JSON.stringify(map, null, 2) + '\n')
  console.log('learning-map.json 반영: ord', find.ord, '×', find.tasks.length)
}
