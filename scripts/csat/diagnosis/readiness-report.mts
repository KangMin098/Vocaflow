// scripts/csat/diagnosis/readiness-report.mts
//
// 진단 반영 판정 보고(읽기 전용 · 2026-10-07) — 평가원 시험마다 readiness.ts 규칙으로 검수 필요 · 완료 · 남음 · 구조 문제 · 켤 수 있는가를 센다.
// DB 를 쓰지 않는다. 관리자 목록 · 켜기 액션과 같은 순수 함수(examReadiness)를 쓴다.
//   cd apps/web && node <tsx cli> --env-file=<.env.local> ../../scripts/csat/diagnosis/readiness-report.mts [--exam M2409]
import { createClient } from '@supabase/supabase-js'

import { examReadiness } from '../../../apps/web/src/lib/csat/diagnosis/readiness.ts'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
const must = async <T,>(q: PromiseLike<{ data: T | null; error: { message: string } | null }>, what: string): Promise<T> => {
  const { data, error } = await q
  if (error) throw new Error(`${what}: ${error.message}`)
  return data as T
}
const focus = process.argv.includes('--exam') ? process.argv[process.argv.indexOf('--exam') + 1] : 'M2409'

const exams = await must(db.from('csat_exams').select('id, label, diagnosis_ready').eq('organizer', 'kice').order('id'), 'exams')
const rows: { id: string; ready: boolean; required: number; reviewed: number; remaining: number; structural: string; canEnable: boolean; afterReview: boolean }[] = []
for (const e of exams as { id: string; label: string; diagnosis_ready: boolean }[]) {
  const keys = await must(db.from('csat_dx_answer_key').select('no').eq('exam_id', e.id), 'keys')
  const items = await must(db.from('csat_items').select('id, answer, answers').eq('exam_id', e.id), 'items') as { id: string; answer: number | null; answers: number[] | null }[]
  const attrs = items.length
    ? await must(db.from('csat_dx_item_attribute').select('item_id, attribute_code, reviewed_at').in('item_id', items.map((i) => i.id)), 'attrs') as { item_id: string; attribute_code: string; reviewed_at: string | null }[]
    : []
  const input = items.map((i) => ({
    id: i.id,
    hasAnswer: (i.answers?.length ?? 0) > 0 || i.answer !== null,
    attrs: attrs.filter((a) => a.item_id === i.id).map((a) => ({ code: a.attribute_code, reviewed: a.reviewed_at !== null })),
  }))
  const r = examReadiness((keys as unknown[]).length, input)
  // 「검수만 끝내면」 — 같은 시험에서 모든 문항이 9개 역량을 검수했다고 가정한 판정(구조 문제는 그대로)
  const after = examReadiness((keys as unknown[]).length, input.map((i) => ({ ...i, attrs: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9'].map((code) => ({ code, reviewed: true })) })))
  rows.push({ id: e.id, ready: e.diagnosis_ready, required: r.required, reviewed: r.reviewed, remaining: r.remaining, structural: r.structural.join(' · '), canEnable: r.canEnable, afterReview: after.canEnable })
  if (e.id === focus) {
    const a1 = new Set(attrs.filter((a) => a.attribute_code === 'A1').map((a) => a.item_id)).size
    console.log(`[${focus}] 문항 ${items.length} · A1 행이 있는 문항 ${a1} · 역량 행 ${attrs.length}(검수 ${attrs.filter((a) => a.reviewed_at).length}) · 정답표 ${(keys as unknown[]).length}`)
    console.log(`[${focus}] 판정: ${r.reason} · 검수 ${r.reviewed}/${r.required} · 검수를 끝내면 켤 수 있나: ${after.canEnable ? '예' : `아니오(${after.reason})`}`)
  }
}
const n = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).length
console.log(`평가원 시험 ${rows.length} · 지금 반영 중 ${n((r) => r.ready)} · 지금 켤 수 있음 ${n((r) => r.canEnable)} · 검수만 끝내면 켤 수 있음 ${n((r) => !r.canEnable && r.afterReview)} · 구조 문제로 검수해도 불가 ${n((r) => !r.afterReview)}`)
for (const r of rows.filter((x) => !x.afterReview)) console.log(`  구조 문제 ${r.id}: ${r.structural}`)
console.log(JSON.stringify(rows.filter((r) => r.afterReview).slice(0, 6)))
