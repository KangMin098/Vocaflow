// scripts/csat/diagnosis/pilot-items-export.mts
//
// 시드 규칙 평가용 문항 메타 픽스처(2026-10-08) — 시험 한 회의 문항 번호 · 유형 ID · 배점 · 선지 낱말 수만(지문 · 선지 본문은 넣지 않는다).
// 시드 규칙 회귀 테스트(apps/web/src/lib/csat/diagnosis/__tests__/seed-rules.test.ts)와 seed-compare 가 DB 없이 이 파일을 읽는다. 읽기 전용.
//   cd apps/web && node <tsx cli> --env-file=<.env.local> ../../scripts/csat/diagnosis/pilot-items-export.mts [--exam M2409]
import fs from 'node:fs'
import path from 'node:path'

import { createClient } from '@supabase/supabase-js'

const EXAM = process.argv.includes('--exam') ? process.argv[process.argv.indexOf('--exam') + 1] : 'M2409'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
const { data: items, error } = await db.from('csat_items').select('no, type_id, choices').eq('exam_id', EXAM).order('no')
if (error || !items) throw new Error(`items: ${error?.message}`)
const { data: keys, error: e2 } = await db.from('csat_dx_answer_key').select('no, points').eq('exam_id', EXAM)
if (e2 || !keys) throw new Error(`keys: ${e2?.message}`)
const words = (c: string) => c.split(/\s*(?:……|…|\.\.\.)\s*/).map((s) => s.trim().split(/\s+/).filter(Boolean).length)
const out = {
  exam: EXAM,
  note: '문항 메타만(지문 · 선지 본문 없음). choiceWords = 선지별 칸마다 낱말 수의 최댓값',
  items: items.map((i) => ({
    no: i.no as number,
    type: i.type_id as string,
    points: (keys.find((k) => k.no === i.no)?.points as number | undefined) ?? null,
    choiceWords: Math.max(...((i.choices as string[] | null) ?? []).map((c) => Math.max(...words(String(c))))),
  })),
}
const file = path.resolve(import.meta.dirname, `pilot/${EXAM}-items.json`)
fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n')
console.log(out.items.map((i) => `${i.no} ${i.type} ${i.points}점 선지${i.choiceWords}`).join('\n'))
