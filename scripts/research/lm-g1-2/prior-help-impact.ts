// scripts/research/lm-g1-2/prior-help-impact.ts
// LM-G1.2 — 근접 해설 규칙(prior-help.crossSessionHelp · M8 2분)의 영향 실측. **읽기 전용**(서비스 키 select 만 · 쓰기 없음).
// 개발 DB 의 확인 과제 첫 시도(learning_first_attempts · activity theater)를 제품과 같은 함수로 다시 판정하고, 보류(uncertain) 중
// 「서버 수신 순서상 제출이 해설보다 먼저 도착」(반례 C2 형 — 정책 변경 후보)을 센다. 사용자 id · 응답 전문은 출력하지 않는다(집계만).
//   node_modules/.bin/tsx --tsconfig apps/web/tsconfig.json scripts/research/lm-g1-2/prior-help-impact.ts  (env: NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY)
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import { crossSessionHelp, type CrossSession } from '../../../apps/web/src/lib/knowledge/prior-help'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const req = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { createClient } = req('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const NEAR = 120_000

async function main() {
  const fa = await db.from('learning_first_attempts').select('attempt_id, user_id, session_id, item_ref, answered_at, synthetic, activity, phase').limit(5000)
  if (fa.error) throw new Error(fa.error.message)
  const rows = (fa.data ?? []).filter((r: { activity: string | null; phase: string }) => r.activity !== 'practice' && r.phase === 'practice')
  const ids = rows.map((r: { attempt_id: number }) => r.attempt_id)
  const users = [...new Set(rows.map((r: { user_id: string }) => r.user_id))]
  const recv = new Map<number, string | null>()
  for (let i = 0; i < ids.length; i += 500) {
    const a = await db.from('learning_task_attempts').select('id, received_at').in('id', ids.slice(i, i + 500))
    if (a.error) throw new Error(a.error.message)
    for (const x of a.data ?? []) recv.set(x.id, x.received_at)
  }
  const sessions = new Map<string, CrossSession[]>()
  for (const u of users) {
    const s = await db.from('learning_sessions').select('id, user_id, item_ref, help_received_at, explanation_viewed_at, help_server_at, explanation_server_at, help_clock_suspect').eq('user_id', u).limit(1000)
    if (s.error) throw new Error(s.error.message)
    sessions.set(u as string, (s.data ?? []) as CrossSession[])
  }
  const out = { measuredAt: new Date().toISOString(), firstAttempts: rows.length, users: users.length, synthetic: 0, independent: 0, helped: 0, uncertain: 0, uncertainServerOrderAnswerFirst: 0, uncertainNearOnly: 0 }
  for (const r of rows as { attempt_id: number; user_id: string; session_id: string | null; item_ref: string; answered_at: string; synthetic: boolean }[]) {
    if (r.synthetic) out.synthetic++
    const ss = sessions.get(r.user_id) ?? []
    const v = crossSessionHelp({ sessionId: r.session_id, itemId: r.item_ref, answeredAt: r.answered_at, receivedAt: recv.get(r.attempt_id) ?? null }, ss)
    out[v]++
    if (v !== 'uncertain') continue
    const received = Date.parse(recv.get(r.attempt_id) ?? '')
    const answered = Date.parse(r.answered_at)
    // C2 형: 다른 세션의 해설/도움이 판단과 2분 안이지만, 서버는 제출을 먼저 받았다(해설 서버 시각 > 제출 수신)
    const near = ss.filter((s) => s.item_ref === r.item_ref && s.id !== r.session_id).flatMap((s) => [[s.help_received_at, s.help_server_at], [s.explanation_viewed_at, s.explanation_server_at]]).filter(([at]) => at && Math.abs(Date.parse(at) - answered) < NEAR)
    if (near.length && near.every(([, srv]) => srv && Number.isFinite(received) && Date.parse(srv) > received)) out.uncertainServerOrderAnswerFirst++
    else out.uncertainNearOnly++
  }
  writeFileSync(path.join(ROOT, 'docs/csat-learner/v62/lm-g1-2/prior-help-impact.json'), JSON.stringify(out, null, 2) + '\n')
  console.log(JSON.stringify(out))
}
main().catch((e) => { console.error(e); process.exit(1) })
