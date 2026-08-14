// apps/web/src/lib/learner/today-status-query.ts
//
// 상태 띠(StatusRibbon)의 **서버 조회부** — ADR 0006 D2.
// 순수 계산은 `today-status.ts` 에 있다. 두 파일을 나눈 이유는 그 파일 머리 주석 참조.
//
// 조회는 셋을 합친다:
//   ① 처방(prescribe_today)  → 오늘 실행 가능한 블록이 무엇인가
//   ② 성장 통계              → streak · 기억 분포(risk+shaky)
//   ③ 오늘 daily_activity    → 어떤 블록에 실제로 활동이 있었나
//
// ①②는 이미 `cache()` 라 같은 요청 안에서 layout·page 가 함께 써도 쿼리는 1회다.
// 여기서 새로 도는 쿼리는 ③ 하나뿐이다.

import 'server-only'

import { cache } from 'react'

import type { SupabaseClient } from '@supabase/supabase-js'

import { fetchGrowthStats } from '@/lib/learner/growth-stats'
import { fetchTodayPrescription } from '@/lib/learner/prescription-actions'
import { computeTodayStatus, type TodayBlockId, type TodayStatus } from '@/lib/learner/today-status'
import { createClient } from '@/lib/supabase/server'

function kstDateIso(): string {
  return new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10)
}

/** by_module 이 jsonb 라 어떤 모양이든 올 수 있다 — 숫자 값만 남긴다. */
function normalizeByModule(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = v
  }
  return out
}

export const fetchTodayStatus = cache(async (): Promise<TodayStatus | null> => {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return null

  const lc = client as unknown as SupabaseClient

  const [prescription, growth, { data: todayRow }] = await Promise.all([
    fetchTodayPrescription(),
    fetchGrowthStats(),
    lc
      .from('daily_activity')
      .select('by_module')
      .eq('user_id', user.id)
      .eq('date', kstDateIso())
      .maybeSingle(),
  ])

  // 오늘 실행 가능한 블록 — 처방이 **실제로 낸 것만** 센다.
  // 처방 계산에 실패했으면(`unavailable`) 블록을 0으로 둔다. 폴백값을 "오늘 할 일" 로
  // 표기하면 실패가 정상처럼 보인다(prescription-actions 의 unavailable 주석 참조).
  const available: TodayBlockId[] = []
  if (prescription && !prescription.unavailable) {
    if (prescription.dueCount > 0) available.push('review')
    if (prescription.input.candidates.length > 0) available.push('read')
    if (prescription.listeningTextId) available.push('listen')
    if (prescription.practiceActive) available.push('practice')
  }

  return computeTodayStatus({
    available,
    byModule: normalizeByModule((todayRow as { by_module?: unknown } | null)?.by_module),
    memory: { risk: growth?.memory.risk ?? 0, shaky: growth?.memory.shaky ?? 0 },
    streak: growth?.streak ?? 0,
  })
})
