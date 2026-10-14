// scripts/csat/map/v62/b7-audit.mts
//
// B7 출시 승인 전 검수(읽기 전용) — 근거 찾기 전이 4문항(2024#31 · 2024#33 · 2023#32 · 2025#34)의 DB · 주석 · 게이트 상태를 문항별로 모은다.
// 쓰기 0. 승인 · 활성화는 하지 않는다(사람 출시 승인 B7 전용).
//   cd apps/web && node --tls-max-v1.2 <tsx cli> --env-file=<.env.local> ../../scripts/csat/map/v62/b7-audit.mts
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(import.meta.dirname, '../../../..')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
const ITEMS = ['2024#31', '2024#33', '2023#32', '2025#34']
const ann = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps/web/src/lib/knowledge/annotations/evidence-tasks.v1.json'), 'utf8')).items
const one = async <T,>(q: PromiseLike<{ data: T[] | null; error: { message: string } | null }>, label: string): Promise<T[]> => {
  const { data, error } = await q
  if (error) throw new Error(`${label}: ${error.message}`)
  return data ?? []
}

const apps = await one<{ id: string; surface_ref: string; status: string; audience: unknown; release_approved_by: string | null }>(
  db.from('knowledge_applications').select('id, surface_ref, status, audience, release_approved_by').eq('surface', 'csat_item_task').like('surface_ref', 'evidence-locate:%'),
  'apps',
)
const trials = await one<{ application_id: string; status: string }>(db.from('knowledge_trials').select('application_id, status').in('application_id', apps.map((a) => a.id)), 'trials').catch(() => [])
const out = []
for (const id of ITEMS) {
  const [exam, no] = id.split('#')
  const sk = JSON.parse(fs.readFileSync(path.join(ROOT, `apps/web/src/lib/csat/skeleton-data/${exam}.json`), 'utf8')).items.find((i: { id: string }) => i.id === id)
  const sig = sk ? crypto.createHash('sha256').update(JSON.stringify(sk.sentences.map((s: { chars: number }) => s.chars))).digest('hex') : null
  const a = ann[id]
  const mine = apps.filter((x) => x.surface_ref.endsWith(`:${exam}-${no}`) || x.surface_ref.endsWith(`:${id}`))
  const isTransfer = (x: { audience: unknown }) => (x.audience as { role?: string } | null)?.role === 'transfer'
  const key = await one<{ answers: number[]; points: number }>(db.from('csat_dx_answer_key').select('answers, points').eq('exam_id', exam).eq('no', Number(no)), 'key')
  const seen = await one<{ user_id: string }>(db.from('learning_first_attempts').select('user_id').eq('item_ref', id), 'first').catch(() => [] as { user_id: string }[])
  out.push({
    item: id,
    annotation: a ? { role: a.role, evidence: a.evidence, disputed: a.disputed, blank: a.blank, sentenceCount: a.sentenceCount, sourceBound: !!a.source?.textHash, skeletonSigMatch: a.skeletonSig === sig } : null,
    applications: mine.map((x) => ({ status: x.status, role: isTransfer(x) ? 'transfer' : 'confirm', releaseApproved: !!x.release_approved_by, trials: trials.filter((t) => t.application_id === x.id).map((t) => t.status) })),
    activeConfirmSameItem: mine.some((x) => x.status === 'active' && !isTransfer(x)),
    answerKey: key[0] ? { answers: key[0].answers, points: key[0].points } : null,
    firstAttemptUsers: new Set(seen.map((s) => s.user_id)).size,
  })
}
const report = { measuredAt: new Date().toISOString(), items: out }
fs.writeFileSync(path.join(ROOT, 'docs/csat-learner/v62/B7_AUDIT.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 1))
