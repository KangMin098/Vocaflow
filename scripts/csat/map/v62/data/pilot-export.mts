// scripts/csat/map/v62/data/pilot-export.mts
//
// 학습 지도 데이터 확대 1차 — 문항↔TASK 심층 매핑 표본(40문항) 입력 내보내기(읽기 전용 · DB 에 쓰지 않는다).
// 표본 규칙(고정 · 무작위 없음): 2026학년도 수능(2026) 독해 18–45 전 28문항 + 2027학년도 6월 모평(M2706)의
//   빈칸 31–34 · 순서 36–37 · 삽입 38–39 · 요약 40 · 요지 22 · 주제 23 · 어법 29 = 12문항.
// 원문 · 선지 · 정답은 git 에 넣지 않는다 → local/pilot-input.json(.gitignore). 공개 산출물은 sha256 으로만 결속한다.
//   cd apps/web && node --env-file=<메인 apps/web/.env.local> --import tsx ../../scripts/csat/map/v62/data/pilot-export.mts
// 이미 local/pilot-input.json 이 있으면 덮어쓰지 않는다(선정 동결 — 다시 만들려면 파일을 직접 지운다).
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..')
const DIR = path.join(ROOT, 'scripts/csat/map/v62/data')
const OUT = path.join(DIR, 'local/pilot-input.json')
const SELECTION = path.join(ROOT, 'docs/csat-learner/v62/data-expansion/pilot-selection.json')
if (fs.existsSync(OUT)) throw new Error(`${path.relative(ROOT, OUT)} 가 이미 있다 — 선정은 동결이다`)
if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })

const ids = [
  ...Array.from({ length: 28 }, (_, k) => `2026#${18 + k}`),
  ...[22, 23, 29, 31, 32, 33, 34, 36, 37, 38, 39, 40].map((n) => `M2706#${n}`),
]
const sha = (v: unknown) => crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex')

const { data: items, error } = await db.from('csat_items')
  .select('id, exam_id, no, type_id, stem, passage, choices, answer, answers, points, body_ok').in('id', ids)
if (error) throw new Error(`csat_items: ${error.message}`)
const { data: analyses, error: aErr } = await db.from('csat_item_analyses')
  .select('item_id, version, status, measured_ability, design_intent, answer_locus, choice_analysis, solve_procedure, difficulty').in('item_id', ids)
if (aErr) throw new Error(`csat_item_analyses: ${aErr.message}`)
const { data: traps, error: tErr } = await db.from('csat_dx_option_trap').select('*').in('item_id', ids)
if (tErr) throw new Error(`csat_dx_option_trap: ${tErr.message}`)

const latest = new Map<string, Record<string, unknown>>()
for (const a of analyses ?? []) if (!latest.has(a.item_id) || (latest.get(a.item_id)!.version as number) < a.version) latest.set(a.item_id, a)
const byId = new Map((items ?? []).map((i) => [i.id, i]))
const missing = ids.filter((id) => !byId.has(id))
if (missing.length) throw new Error(`없는 문항: ${missing.join(', ')}`)

const rows = ids.map((id) => {
  const i = byId.get(id)!
  const a = latest.get(id) ?? null
  const source = { stem: i.stem, passage: i.passage, choices: i.choices, answer: i.answer, answers: i.answers, points: i.points }
  return {
    item_id: id, exam_id: i.exam_id, no: i.no, type_id: i.type_id, body_ok: i.body_ok,
    source, source_sha256: sha(source),
    analysis: a, analysis_sha256: a ? sha(a) : null,
    traps: (traps ?? []).filter((t) => t.item_id === id),
  }
})
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify({ generated_at: new Date().toISOString(), rows }, null, 1))
const selection = {
  version: 'map-data-pilot-1',
  rule: '2026 수능 독해 18–45 전 28 + M2706 핵심 유형 12 (고정 · 무작위 없음)',
  frame_note: '최근 완료 평가원·수능(우선순위 1). 786문항 전체의 대표 표본이 아니다 — 정확도 · 누락률을 전체로 일반화하지 않는다.',
  items: rows.map((r) => ({ item_id: r.item_id, type_id: r.type_id, body_ok: r.body_ok, source_sha256: r.source_sha256, analysis_version: (r.analysis?.version as number | undefined) ?? null, analysis_status: (r.analysis?.status as string | undefined) ?? null, analysis_sha256: r.analysis_sha256, trap_rows: r.traps.length })),
}
fs.mkdirSync(path.dirname(SELECTION), { recursive: true })
fs.writeFileSync(SELECTION, JSON.stringify({ ...selection, selection_sha256: sha(selection.items) }, null, 1) + '\n')
console.log(`문항 ${rows.length} · 분석 ${rows.filter((r) => r.analysis).length} · 함정 행 ${rows.reduce((s, r) => s + r.traps.length, 0)} → ${path.relative(ROOT, OUT)}`)
