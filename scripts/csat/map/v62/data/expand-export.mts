// scripts/csat/map/v62/data/expand-export.mts
//
// 문항↔TASK 확대 배치 입력 — 평가원 · 수능(organizer=kice) 전 독해 문항 중 표본(pilot-input) 밖 문항(읽기 전용).
// 원문 · 정답은 local/expand-input.json(.gitignore) · 공개 목록은 docs/.../expand-selection.json(sha 만).
//   cd apps/web && node --tls-max-v1.2 --env-file=<메인 apps/web/.env.local> --import tsx ../../scripts/csat/map/v62/data/expand-export.mts
// 이미 있으면 덮어쓰지 않는다(선정 동결).
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..')
const LOCAL = path.join(ROOT, 'scripts/csat/map/v62/data/local')
const OUT = path.join(LOCAL, 'expand-input.json')
const SELECTION = path.join(ROOT, 'docs/csat-learner/v62/data-expansion/expand-selection.json')
if (fs.existsSync(OUT)) throw new Error(`${path.relative(ROOT, OUT)} 가 이미 있다 — 선정은 동결이다`)
if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
const sha = (v: unknown) => crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex')

const pilot = new Set(JSON.parse(fs.readFileSync(path.join(LOCAL, 'pilot-input.json'), 'utf8')).rows.map((r: { item_id: string }) => r.item_id))
const { data: exams, error: eErr } = await db.from('csat_exams').select('id').eq('organizer', 'kice')
if (eErr) throw new Error(`csat_exams: ${eErr.message}`)
const rows: Record<string, unknown>[] = []
// keyset(id) — 뒤 페이지가 앞을 다시 훑지 않는다(offset-paging-budget). 순서·산출은 order('id') 그대로.
for (let last = ''; ; ) {
  const { data, error } = await db.from('csat_items').select('id, exam_id, no, type_id, stem, passage, choices, answer, answers, points').in('exam_id', (exams ?? []).map((e) => e.id)).gt('id', last).order('id').limit(1000)
  if (error) throw new Error(`csat_items: ${error.message}`)
  for (const i of data ?? []) {
    if (pilot.has(i.id)) continue
    const source = { stem: i.stem, passage: i.passage, choices: i.choices, answer: i.answer, answers: i.answers, points: i.points }
    rows.push({ item_id: i.id, exam_id: i.exam_id, no: i.no, type_id: i.type_id, source, source_sha256: sha(source) })
  }
  if ((data ?? []).length < 1000) break
  last = String(data![data!.length - 1].id)
}
// 같은 시험 · 번호 순 — 세트 문항(41–42 · 43–45)이 같은 청크에 모이게
rows.sort((a, b) => String(a.exam_id).localeCompare(String(b.exam_id)) || (a.no as number) - (b.no as number))
fs.mkdirSync(LOCAL, { recursive: true })
fs.writeFileSync(OUT, JSON.stringify({ generated_at: new Date().toISOString(), rows }, null, 1))
const items = rows.map((r) => ({ item_id: r.item_id, type_id: r.type_id, source_sha256: r.source_sha256 }))
fs.writeFileSync(SELECTION, JSON.stringify({ version: 'map-data-expand-1', rule: 'organizer=kice 전 독해 문항 − 표본 40', items, selection_sha256: sha(items) }, null, 1) + '\n')
console.log(`문항 ${rows.length} → ${path.relative(ROOT, OUT)}`)
