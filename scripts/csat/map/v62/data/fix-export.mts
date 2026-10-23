// scripts/csat/map/v62/data/fix-export.mts
//
// 발문 수정(docs/.../source-fixes.json) 문항의 수정 후 원문 내보내기 — r5r6-fix 배치 입력(읽기 전용).
// 수정 후 발문 md5 가 source-fixes 의 new_md5 와 다르면 멈춘다(그사이 다시 바뀐 원문으로 판정하지 않는다).
//   cd apps/web && node --tls-max-v1.2 --env-file=<메인 apps/web/.env.local> --import tsx ../../scripts/csat/map/v62/data/fix-export.mts
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..')
// FIX_BATCH 미지정 = 1차(batch 없음) → fix-input.json · FIX_BATCH=2 → fix2-input.json
const FIX_BATCH = process.env.FIX_BATCH ?? ''
const OUT = path.join(ROOT, `scripts/csat/map/v62/data/local/fix${FIX_BATCH}-input.json`)
if (fs.existsSync(OUT)) throw new Error(`${path.relative(ROOT, OUT)} 가 이미 있다 — 선정은 동결이다`)
if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
const sha = (v: unknown) => crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex')
const md5 = (s: string) => crypto.createHash('md5').update(s).digest('hex')

const fixes: { item: string; new_md5: string; batch?: string }[] = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/csat-learner/v62/data-expansion/source-fixes.json'), 'utf8')).fixes.filter((x: { batch?: string }) => (x.batch ?? '') === FIX_BATCH)
const { data, error } = await db.from('csat_items').select('id, exam_id, no, type_id, stem, passage, choices, answer, answers, points').in('id', fixes.map((f) => f.item))
if (error) throw new Error(`csat_items: ${error.message}`)
const rows = fixes.map((f) => {
  const i = (data ?? []).find((r) => r.id === f.item)
  if (!i) throw new Error(`없는 문항 ${f.item}`)
  if (md5(i.stem ?? '') !== f.new_md5) throw new Error(`${f.item} 발문이 수정 기록과 다르다(md5 ${md5(i.stem ?? '')} ≠ ${f.new_md5})`)
  const source = { stem: i.stem, passage: i.passage, choices: i.choices, answer: i.answer, answers: i.answers, points: i.points }
  return { item_id: i.id, exam_id: i.exam_id, no: i.no, type_id: i.type_id, source, source_sha256: sha(source) }
})
fs.writeFileSync(OUT, JSON.stringify({ generated_at: new Date().toISOString(), rows }, null, 1))
console.log(`문항 ${rows.length} → ${path.relative(ROOT, OUT)}`)
