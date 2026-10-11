// scripts/csat/diagnosis/review-export.mts
//
// 진단 태깅 검수(드레인) 내보내기 — 2026-10-11 · 학습 지도 rev4.0 4차. **읽기 전용 · DB 에 쓰지 않는다.**
// 문항마다 본문 · 선지 · 정답 · 유형 · 배점 · 해설 요지(측정 능력 · 근거 위치 · 선지 분석) · 시드 v2 가중치 · 선지 함정을 묶어
// tmp/review/<exam>-items-full.json 으로 쓴다(tmp 는 git 제외 — 원문 전체가 들어간다). 검수자(에이전트)는 이 파일만 읽고
// tmp/review/<exam>-review-<검수자>.json 을 쓴다. 판정 규칙 · 질문은 M2409 검수 패킷과 같다(pilot-runs/M2409-review-packet.md).
//   cd apps/web && node --env-file=.env.local --import tsx ../../scripts/csat/diagnosis/review-export.mts 2026 M2706
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import { seedWeights } from '../../../apps/web/src/lib/csat/diagnosis/seed-rules.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
const exams = process.argv.slice(2)
fs.mkdirSync(path.join(ROOT, 'tmp/review'), { recursive: true })
for (const exam of exams) {
  const meta = JSON.parse(fs.readFileSync(path.join(ROOT, `scripts/csat/diagnosis/pilot/${exam}-items.json`), 'utf8')) as { items: { no: number; type: string; points: number | null; choiceWords: number | null }[] }
  const { data: items, error } = await db.from('csat_items').select('id, no, type_id, stem, passage, choices, answer, answers').eq('exam_id', exam).order('no')
  if (error || !items) throw new Error(`items: ${error?.message}`)
  const ids = items.map((i) => i.id)
  const [an, tr, fam] = await Promise.all([
    db.from('csat_item_analyses').select('item_id, version, status, measured_ability, answer_locus, choice_analysis').in('item_id', ids).eq('status', 'published'),
    db.from('csat_dx_option_trap').select('item_id, option_no, trap_key').in('item_id', ids),
    db.from('csat_dx_trap_family').select('trap_key, family'),
  ])
  if (an.error || tr.error || fam.error) throw new Error('analysis/trap 조회 실패')
  const familyOf = new Map((fam.data ?? []).map((f) => [f.trap_key, f.family]))
  const out = items.map((i) => {
    const m = meta.items.find((x) => x.no === i.no)
    const a = (an.data ?? []).filter((x) => x.item_id === i.id).sort((x, y) => y.version - x.version)[0]
    return {
      no: i.no, itemId: i.id, type: i.type_id, points: m?.points ?? null,
      stem: i.stem, passage: i.passage, choices: i.choices, answer: i.answers?.length ? i.answers : [i.answer],
      seedV2: seedWeights({ type: i.type_id as string, choiceWords: m?.choiceWords ?? null }).weights,
      analysis: a ? { version: a.version, measured_ability: a.measured_ability, answer_locus: a.answer_locus, choice_analysis: a.choice_analysis } : null,
      traps: (tr.data ?? []).filter((t) => t.item_id === i.id).map((t) => ({ option: t.option_no, trap: t.trap_key, family: familyOf.get(t.trap_key) ?? null })),
    }
  })
  fs.writeFileSync(path.join(ROOT, `tmp/review/${exam}-items-full.json`), JSON.stringify({ exam, generated_by: 'scripts/csat/diagnosis/review-export.mts', items: out }, null, 1))
  console.log(`${exam}: ${out.length}문항 → tmp/review/${exam}-items-full.json`)
}
