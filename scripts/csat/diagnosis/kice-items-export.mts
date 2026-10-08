// scripts/csat/diagnosis/kice-items-export.mts
//
// 관측가능성 감사용 평가원 시험 문항 메타 픽스처(2026-10-08) — DB 읽기만. 평가원(isKiceExam)만, 독해 문항(18~45)만.
// 문항 번호 · 유형 ID · 배점 · 선지 칸당 최대 낱말 수만 담는다(지문 · 선지 본문 없음). 시드 v2(코드 규칙 — proposed/unreviewed)로
// 문항 × 축 행렬을 만드는 입력이다. 결과 → scripts/csat/diagnosis/pilot/kice-items.json
//   cd apps/web && node <tsx cli> --env-file=<.env.local> ../../scripts/csat/diagnosis/kice-items-export.mts
import fs from 'node:fs'
import path from 'node:path'

import { createClient } from '@supabase/supabase-js'

import { examOrder, isKiceExam } from '../lib-exam-id.mjs'

if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
const must = async <T,>(q: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<T[]> => {
  const { data, error } = await q
  if (error) throw new Error(`${what}: ${error.message}`)
  return (data ?? []) as T[]
}
const words = (c: string) => Math.max(...String(c).split(/\s*(?:……|…|\.\.\.)\s*/).map((s) => s.trim().split(/\s+/).filter(Boolean).length))

const exams = (await must<{ id: string }>(db.from('csat_exams').select('id'), 'exams')).map((e) => e.id).filter((id) => isKiceExam(id))
exams.sort((a, b) => examOrder(a) - examOrder(b))
const out: { exam: string; items: { no: number; type: string; points: number | null; choiceWords: number | null }[] }[] = []
for (const exam of exams) {
  const items = await must<{ no: number; type_id: string | null; choices: string[] | null }>(db.from('csat_items').select('no, type_id, choices').eq('exam_id', exam).gte('no', 18).lte('no', 45).order('no'), `items ${exam}`)
  const keys = await must<{ no: number; points: number }>(db.from('csat_dx_answer_key').select('no, points').eq('exam_id', exam), `keys ${exam}`)
  const rows = items.filter((i) => i.type_id).map((i) => ({
    no: i.no,
    type: i.type_id as string,
    points: keys.find((k) => k.no === i.no)?.points ?? null,
    choiceWords: i.choices?.length ? Math.max(...i.choices.map(words)) : null,
  }))
  if (rows.length) out.push({ exam, items: rows })
}
const file = path.resolve(import.meta.dirname, 'pilot/kice-items.json')
fs.writeFileSync(file, JSON.stringify({ note: '평가원 독해 18~45 메타만(지문 · 선지 본문 없음) — 2026-10-08', exams: out }) + '\n')
console.log(`시험 ${out.length} · 문항 ${out.reduce((n, e) => n + e.items.length, 0)} · 배점 없음 ${out.reduce((n, e) => n + e.items.filter((i) => i.points === null).length, 0)} · ${out.map((e) => `${e.exam}:${e.items.length}`).join(' ')}`)
