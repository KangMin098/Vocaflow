// scripts/csat/pilot/synthetic/dump-items.mts
//
// G6-S 생성 입력 — 두 시험의 독해 문항(18–45) 원문 · 선지 · 정답 · 유형과 지문 문장 분할(앱과 같은 splitSentences)을
// 저장소 밖 .pilot-private/synthetic/items.json 에 쓴다(문항 원문 · 정답이 들어가므로 저장소에 두지 않는다).
//   pnpm --filter web exec tsx --env-file=<apps/web/.env.local> ../../scripts/csat/pilot/synthetic/dump-items.mts
import fs from 'node:fs'
import path from 'node:path'

import { createClient } from '@supabase/supabase-js'

import { splitSentences } from '../../../../apps/web/src/lib/csat/passage-skeleton'

const ROOT = path.resolve(import.meta.dirname, '../../../..')
const personas = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'personas.json'), 'utf8')) as { exams: string[]; targets: number[] }
const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

const out: Record<string, unknown[]> = {}
for (const exam of personas.exams) {
  const { data, error } = await svc.from('csat_items').select('id, no, type_id, stem, passage, choices, answer').eq('exam_id', exam).gte('no', 18).lte('no', 45).order('no')
  if (error) throw new Error(`${exam}: ${error.message}`)
  out[exam] = (data ?? []).map((i) => {
    const passage = (i.passage as string | null) ?? ''
    return {
      no: i.no, id: i.id, type: i.type_id, target: personas.targets.includes(i.no as number), answer: i.answer, stem: i.stem,
      choices: i.choices,
      sentences: splitSentences(passage).filter((r) => r.end > r.start && passage.slice(r.start, r.end).trim()).map((r, k) => ({ k, text: passage.slice(r.start, r.end).trim() })),
    }
  })
}
const dst = path.join(ROOT, '.pilot-private/synthetic/items.json')
fs.mkdirSync(path.dirname(dst), { recursive: true })
fs.writeFileSync(dst, JSON.stringify(out, null, 1))
console.log(Object.entries(out).map(([e, l]) => `${e}: ${l.length}문항(대상 ${(l as { target: boolean }[]).filter((x) => x.target).length})`).join(' · '))
