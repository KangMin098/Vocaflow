// scripts/csat/diagnosis/pilot-export.mts
//
// 한 시험 검수 파일럿(2026-10-07) — 검수 전 상태 기록 + 검수용 묶음 만들기(읽기 전용).
//   tmp/pilot/<exam>-before.json  : 검수 전 상태(문항 · 역량 행 · 선지 함정 · diagnosis_ready) — 되돌릴 때의 기준
//   tmp/pilot/<exam>-review.json  : 문항마다 번호 · 유형 · 발문 · 지문 · 선지 · 정답 · 시드 가중치(A1~A9, 없음 = null) · 함정
//   cd apps/web && node <tsx cli> --env-file=<.env.local> ../../scripts/csat/diagnosis/pilot-export.mts [--exam M2409]
import fs from 'node:fs'
import path from 'node:path'

import { createClient } from '@supabase/supabase-js'

import { ATTRIBUTE_CODES } from '../../../apps/web/src/lib/csat/diagnosis/engine/types.ts'

const EXAM = process.argv.includes('--exam') ? process.argv[process.argv.indexOf('--exam') + 1] : 'M2409'
const OUT = path.resolve(import.meta.dirname, '../../../tmp/pilot')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
type Row = Record<string, unknown>
const must = async <T = Row[],>(q: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<T> => {
  const { data, error } = await q
  if (error) throw new Error(`${what}: ${error.message}`)
  return data as T
}
const [exam] = await must<Row[]>(db.from('csat_exams').select('id, label, diagnosis_ready').eq('id', EXAM), 'exam')
const items = await must<Row[]>(db.from('csat_items').select('id, no, type_id, stem, passage, choices, answer, answers').eq('exam_id', EXAM).order('no'), 'items')
const ids = items.map((i) => i.id as string)
const attrs = await must<Row[]>(db.from('csat_dx_item_attribute').select('*').in('item_id', ids), 'attrs')
const traps = await must<Row[]>(db.from('csat_dx_option_trap').select('*').in('item_id', ids), 'traps')
const types = await must<Row[]>(db.from('csat_types').select('id, name').in('id', [...new Set(items.map((i) => i.type_id as string))]), 'types')
fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, `${EXAM}-before.json`), JSON.stringify({ at: new Date().toISOString(), exam, attrs, traps }, null, 1))
const review = items.map((i) => ({
  id: i.id,
  no: i.no,
  type: (types.find((t) => t.id === i.type_id)?.name as string) ?? i.type_id,
  stem: i.stem,
  passage: i.passage,
  choices: i.choices,
  answer: (i.answers as number[] | null)?.length ? i.answers : [i.answer],
  seed: Object.fromEntries(ATTRIBUTE_CODES.map((c) => [c, (attrs.find((a) => a.item_id === i.id && a.attribute_code === c)?.weight as number | undefined) ?? null])),
  traps: Object.fromEntries(traps.filter((t) => t.item_id === i.id).map((t) => [t.option_no, t.trap_key])),
}))
fs.writeFileSync(path.join(OUT, `${EXAM}-review.json`), JSON.stringify(review, null, 1))
console.log(`${EXAM} ${exam.label} · ready=${exam.diagnosis_ready} · 문항 ${items.length} · 역량 행 ${attrs.length}(검수 ${attrs.filter((a) => a.reviewed_at).length}) · 함정 ${traps.length}`)
console.log(review.map((r) => `${r.no} ${r.type} seed=${ATTRIBUTE_CODES.filter((c) => r.seed[c] !== null).map((c) => `${c}:${r.seed[c]}`).join(',')}`).join('\n'))
