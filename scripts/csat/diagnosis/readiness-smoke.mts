// scripts/csat/diagnosis/readiness-smoke.mts
//
// 진단 반영 판정 DB smoke(2026-10-07) — 실제 검수 저장 RPC(csat_dx_save_item_tagging)를 거치면 판정이 「켤 수 있음」이 되는지,
// 하나라도 남으면 막히는지 개발 DB 에서 본다. 실제 시험 · 실제 검수 표지를 건드리지 않으려고 이 실행 동안만 있는 TEST 시험(M2097)을 쓴다:
//   평가원 M2409 의 문항 · 정답표 · 유형 기본값 시드 태깅(미검수) · 선지 함정을 복사 → 판정(남음 28) → 문항마다 RPC 로 검수 저장
//   (가중치는 시드 값 그대로, 없는 역량은 0 = 해당 없음) → 판정(마지막 1문항 전 = 차단, 뒤 = 켤 수 있음) → 전부 삭제.
// diagnosis_ready 는 켜지 않는다(판정만 본다). 개발 프로젝트가 아니면 · M2097 이 이미 있으면 멈춘다.
//   cd apps/web && node <tsx cli> --env-file=<.env.local> ../../scripts/csat/diagnosis/readiness-smoke.mts
import { createClient } from '@supabase/supabase-js'

import { ATTRIBUTE_CODES } from '../../../apps/web/src/lib/csat/diagnosis/engine/types.ts'
import { examReadiness } from '../../../apps/web/src/lib/csat/diagnosis/readiness.ts'
import { isKiceExam } from '../lib-exam-id.mjs'

const SRC = 'M2409'
const FX = 'M2097'
if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
if (!isKiceExam(SRC)) throw new Error('원본은 평가원 시험이어야 한다')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
type Row = Record<string, unknown>
const must = async <T = Row[],>(q: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<T> => {
  const { data, error } = await q
  if (error) throw new Error(`${what}: ${error.message}`)
  return data as T
}
let fail = 0
const rec = (name: string, ok: boolean, detail: unknown = '') => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail === '' ? '' : ' — ' + JSON.stringify(detail)}`) }

async function readiness() {
  const keys = await must(db.from('csat_dx_answer_key').select('no').eq('exam_id', FX), 'keys')
  const items = await must<{ id: string; answer: number | null; answers: number[] | null }[]>(db.from('csat_items').select('id, answer, answers').eq('exam_id', FX), 'items')
  const attrs = await must<{ item_id: string; attribute_code: string; reviewed_at: string | null }[]>(db.from('csat_dx_item_attribute').select('item_id, attribute_code, reviewed_at').in('item_id', items.map((i) => i.id)), 'attrs')
  return examReadiness(keys.length, items.map((i) => ({ id: i.id, hasAnswer: (i.answers?.length ?? 0) > 0 || i.answer !== null, attrs: attrs.filter((a) => a.item_id === i.id).map((a) => ({ code: a.attribute_code, reviewed: a.reviewed_at !== null })) })))
}

const exists = await must(db.from('csat_exams').select('id').eq('id', FX), 'exists')
if (exists.length) throw new Error(`${FX} 가 이미 있다 — 지우지 않고 멈춘다`)
const idMap: Record<string, string> = {}
try {
  const [ex] = await must(db.from('csat_exams').select('*').eq('id', SRC), 'src exam')
  await must(db.from('csat_exams').insert({ ...ex, id: FX, label: 'TEST 진단 반영 판정 smoke(자동 생성 · 실행 뒤 삭제)', year: 2097, exam_year: 2096, diagnosis_ready: false }), 'fx exam')
  const items = await must<Row[]>(db.from('csat_items').select('*').eq('exam_id', SRC), 'src items')
  for (const it of items) idMap[it.id as string] = `${FX}-${it.no}`
  await must(db.from('csat_items').insert(items.map((it) => ({ ...it, id: idMap[it.id as string], exam_id: FX }))), 'fx items')
  const keys = await must<Row[]>(db.from('csat_dx_answer_key').select('*').eq('exam_id', SRC), 'src keys')
  await must(db.from('csat_dx_answer_key').insert(keys.map((k) => ({ ...k, exam_id: FX }))), 'fx keys')
  const attrs = await must<Row[]>(db.from('csat_dx_item_attribute').select('*').in('item_id', Object.keys(idMap)), 'src attrs')
  // 시드 그대로(미검수) 복사 — 실제 상태와 같은 출발점
  await must(db.from('csat_dx_item_attribute').insert(attrs.map((a) => ({ ...a, item_id: idMap[a.item_id as string], reviewed_at: null, reviewed_by: null, source: 'type_default' }))), 'fx attrs')
  const traps = await must<Row[]>(db.from('csat_dx_option_trap').select('*').in('item_id', Object.keys(idMap)), 'src traps')

  const r0 = await readiness()
  rec('시작 — 시드만(미검수): 남음 = 문항 수, 켤 수 없음, 이유 「검수 완료 후 가능」', r0.reviewed === 0 && r0.remaining === r0.required && !r0.canEnable && /검수 완료 후 가능/.test(r0.reason), r0)
  const fxItems = Object.values(idMap)
  for (const [n, id] of fxItems.entries()) {
    const src = Object.keys(idMap).find((k) => idMap[k] === id) as string
    const weights = Object.fromEntries(ATTRIBUTE_CODES.map((c) => [c, Number(attrs.find((a) => a.item_id === src && a.attribute_code === c)?.weight ?? 0)]))
    const tr = Object.fromEntries([1, 2, 3, 4, 5].map((o) => [String(o), (traps.find((t) => t.item_id === src && t.option_no === o)?.trap_key as string | undefined) ?? null]))
    const { error } = await db.rpc('csat_dx_save_item_tagging', { p_item_id: id, p_weights: weights, p_traps: tr, p_error_rate: null, p_ebs: null, p_by: null })
    if (error) throw new Error(`검수 저장 ${id}: ${error.message}`)
    if (n === fxItems.length - 2) {
      const r1 = await readiness()
      rec('한 문항 남김 — 차단(남음 1)', r1.remaining === 1 && !r1.canEnable, { reviewed: r1.reviewed, remaining: r1.remaining })
    }
  }
  const after = await must<{ item_id: string }[]>(db.from('csat_dx_item_attribute').select('item_id').in('item_id', fxItems).not('reviewed_at', 'is', null), 'after rows')
  rec('검수 저장 RPC 는 문항마다 9행(0 = 해당 없음 포함)을 검수 표지와 함께 쓴다', after.length === fxItems.length * 9, { rows: after.length, items: fxItems.length })
  const r2 = await readiness()
  rec('모든 문항 검수 뒤 — 켤 수 있음(A1 부재 시드 문항도 막히지 않음)', r2.canEnable && r2.reviewed === r2.required, r2)
} catch (e) {
  rec('실행', false, (e as Error).message)
} finally {
  const ids = Object.values(idMap)
  if (ids.length) {
    await db.from('csat_dx_option_trap').delete().in('item_id', ids)
    await db.from('csat_dx_item_attribute').delete().in('item_id', ids)
  }
  await db.from('csat_dx_answer_key').delete().eq('exam_id', FX)
  await db.from('csat_items').delete().eq('exam_id', FX)
  await db.from('csat_exams').delete().eq('id', FX)
  const left = await must(db.from('csat_exams').select('id').eq('id', FX), 'left')
  rec('정리 — TEST 시험 남지 않음', left.length === 0)
  console.log(fail ? `실패 ${fail}` : '모든 단언 통과')
  process.exit(fail ? 1 : 0)
}
