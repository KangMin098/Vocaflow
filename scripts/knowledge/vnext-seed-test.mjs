// scripts/knowledge/vnext-seed-test.mjs
//
// 시범 시드(vnext-pilot-seed.sql)를 PGlite 에서 두 번 적용해 결과 수와 재실행 안전을 확인한다(원격 DB 안 씀).
// 실행: node scripts/knowledge/vnext-seed-test.mjs <@electric-sql/pglite 가 설치된 디렉터리>
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const { PGlite } = createRequire(path.join(path.resolve(process.argv[2] ?? '.'), 'noop.js'))('@electric-sql/pglite')
const MIG = path.resolve('supabase/migrations')
const SEED = fs.readFileSync(path.resolve('scripts/knowledge/vnext-pilot-seed.sql'), 'utf8')
const db = new PGlite()
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth; create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  create table public.csat_items (id text primary key);
  create table public.funnel_events (id bigserial primary key, event text not null,
    constraint funnel_events_event_check check (event = any (array['screen_viewed']::text[])));
`)
for (const f of fs.readdirSync(MIG).filter((f) => /knowledge|methodology_intelligence/.test(f) && f.endsWith('.sql')).sort()) {
  await db.exec(fs.readFileSync(path.join(MIG, f), 'utf8'))
}
// 운영 DB 에 이미 있는 항목들(2026-10-08 실측 slug)을 최소 모양으로 만든다
const principles = ['cohesion-cues', 'sequential-processing', 'task-directed-attention', 'phonological-decoding', 'active-recall', 'spaced-repetition', 'desirable-difficulty', 'dual-coding', 'context-dependent', 'cognitive-load', 'emotional-encoding', 'feedback-comparison', 'output-automatization']
const rows = [
  ...principles.map((s) => `('principle','${s}','${s}','s','in_review')`),
  `('method','method-gist-synthesis','g','s','in_review')`,
  `('practice','yt-e4ce5f5963d2','p1','s','extracted')`,
  `('practice','yt-7463360832d2','p2','s','extracted')`,
]
await db.exec(`insert into knowledge_items (layer,slug,title,statement,status,created_by,updated_by) select l,s,t,st,stt,'t','t' from (values ${rows.join(',')}) v(l,s,t,st,stt);`)
await db.exec(`insert into knowledge_evidence (item_id,grade,attribution,source_type,external_url,external_title,created_by)
  select id,'A','stated','external','https://youtu.be/x','yt','t' from knowledge_items where slug like 'yt-%'`)

const count = async () =>
  (
    await db.query(`select
      (select count(*)::int from knowledge_items) items,
      (select count(*)::int from knowledge_links) links,
      (select count(*)::int from knowledge_evidence) evidence,
      (select count(*)::int from knowledge_evidence where research_level='practitioner_claim') practitioner,
      (select count(*)::int from knowledge_items where facet is not null) faceted,
      (select count(*)::int from knowledge_inquiries) inquiries,
      (select count(*)::int from knowledge_inquiry_positions) positions,
      (select count(*)::int from knowledge_gaps) gaps,
      (select count(*)::int from knowledge_designs) designs,
      (select count(*)::int from knowledge_design_items) design_items,
      (select status from knowledge_designs where slug='claim-evidence-v1') design_status`)
  ).rows[0]

await db.exec(SEED)
const first = await count()
await db.exec(SEED)
const second = await count()
console.log('1회', first)
console.log('2회', second)
const expect = { items: 18, links: 6, evidence: 8, practitioner: 2, faceted: 13, inquiries: 1, positions: 6, gaps: 1, designs: 1, design_items: 8, design_status: 'ready' }
let bad = 0
for (const [k, v] of Object.entries(expect)) {
  if (first[k] !== v) { bad++; console.log('✗', k, '기대', v, '실제', first[k]) }
}
if (JSON.stringify(first) !== JSON.stringify(second)) { bad++; console.log('✗ 재실행에서 수가 바뀌었다') }
// 배포는 막혀야 한다(아무것도 채택 안 됨)
try {
  await db.exec(`update knowledge_designs set status='deployed' where slug='claim-evidence-v1'`)
  bad++; console.log('✗ 채택 없이 배포됐다')
} catch (e) { console.log('✓ 채택 전 배포 거부 →', e.message.slice(0, 60)) }
console.log(bad ? `${bad} 실패` : '✓ 시드 결과 수 일치 · 재실행 안전')
process.exit(bad ? 1 : 0)
