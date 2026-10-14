// scripts/csat/map/v62/product-availability.mts
//
// 학습지도 v6.2 P-M0 — 제품 실측(읽기 전용). 연구 coverage.json 의 unsupported 를 제품 상태로 복사하지 않고 DB 에서 직접 센다(v6.2 §8.3).
//   ① Workspace(Template) 별 출시된 확인 문항 · 전이 문항 · 초안(미출시) 수 — knowledge_applications(surface='csat_item_task')
//   ② 평가원 시험별 정답표 인벤토리 — 45문항 · 100점 체제와 대조(inventory.ts · 독해만이면 partial)
//   ③ 진단 반영 시험 수
// 쓰기 0. 결과는 docs/csat-learner/v62/PRODUCT_AVAILABILITY.json 과 표준 출력.
//   cd apps/web && node --tls-max-v1.2 <tsx cli> --env-file=<.env.local> ../../scripts/csat/map/v62/product-availability.mts
import fs from 'node:fs'
import path from 'node:path'

import { createClient } from '@supabase/supabase-js'

import { templates } from '../../../../apps/web/src/lib/csat/map/v4/definition'
import { CURRENT_ENGLISH_BLUEPRINT, examInventoryCoverage } from '../../../../apps/web/src/lib/csat/map/v62/inventory'

const ROOT = path.resolve(import.meta.dirname, '../../../..')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })

async function all<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) return out
  }
}

const apps = await all<{ surface_ref: string; status: string; audience: unknown }>((a, b) => db.from('knowledge_applications').select('surface_ref, status, audience').eq('surface', 'csat_item_task').range(a, b))
const isTransfer = (aud: unknown) => !!aud && typeof aud === 'object' && (aud as { role?: unknown }).role === 'transfer'
const byKey = new Map<string, { confirmActive: Set<string>; transferActive: Set<string>; draft: Set<string>; paused: Set<string> }>()
for (const a of apps) {
  const [key, item] = a.surface_ref.split(':')
  if (!key || !item) continue
  const k = byKey.get(key) ?? { confirmActive: new Set(), transferActive: new Set(), draft: new Set(), paused: new Set() }
  if (a.status === 'active') (isTransfer(a.audience) ? k.transferActive : k.confirmActive).add(item)
  else if (a.status === 'draft') k.draft.add(item)
  else k.paused.add(item)
  byKey.set(key, k)
}

const workspaces = templates().map((t) => {
  const keys = t.content_keys
  const sum = (f: 'confirmActive' | 'transferActive' | 'draft' | 'paused') => keys.reduce((s, k) => s + (byKey.get(k)?.[f].size ?? 0), 0)
  return { id: t.id, name: t.name, core: t.core, readiness: t.readiness, hold: t.hold, contentKeys: keys, confirmActive: sum('confirmActive'), transferActive: sum('transferActive'), draftUnreleased: sum('draft'), pausedOrRolledBack: sum('paused') }
})

const exams = await all<{ id: string; label: string; organizer: string; diagnosis_ready: boolean | null }>((a, b) => db.from('csat_exams').select('id, label, organizer, diagnosis_ready').eq('organizer', 'kice').range(a, b))
const keys = await all<{ exam_id: string; no: number; points: number }>((a, b) => db.from('csat_dx_answer_key').select('exam_id, no, points').range(a, b))
const keyByExam = new Map<string, { no: number; points: number }[]>()
for (const k of keys) keyByExam.set(k.exam_id, [...(keyByExam.get(k.exam_id) ?? []), { no: k.no, points: k.points }])
const inventory = exams.map((e) => examInventoryCoverage(e.id, CURRENT_ENGLISH_BLUEPRINT, keyByExam.get(e.id) ?? []))
const invCount = (s: string) => inventory.filter((c) => c.status === s).length

const report = {
  measuredAt: new Date().toISOString(),
  note: '읽기 전용 실측 — 플랫폼 지원 상태이며 학생 능력 · 학습 효과가 아니다',
  workspaces,
  exams: { kice: exams.length, diagnosisReady: exams.filter((e) => e.diagnosis_ready).length, inventory: { supported: invCount('supported'), partial: invCount('partial'), unsupported: invCount('unsupported') } },
  inventoryPartial: inventory.filter((c) => c.status === 'partial').map((c) => ({ exam: c.examId, covered: c.covered, issues: c.issues.length })),
}
const out = path.join(ROOT, 'docs/csat-learner/v62/PRODUCT_AVAILABILITY.json')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n')
console.table(workspaces.map((w) => ({ id: w.id, readiness: w.readiness, confirm: w.confirmActive, transfer: w.transferActive, draft: w.draftUnreleased, paused: w.pausedOrRolledBack })))
console.log(JSON.stringify(report.exams))
