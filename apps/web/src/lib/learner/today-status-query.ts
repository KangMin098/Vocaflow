// apps/web/src/lib/learner/today-status-query.ts
//
// 상태 띠(StatusRibbon)의 **서버 조회부** — ADR 0006 D2.
// 순수 계산은 `today-status.ts` 에 있다. 두 파일을 나눈 이유는 그 파일 머리 주석 참조.
//
// 조회는 셋을 합친다:
//   ① 처방(prescribe_today)  → 오늘의 5블록이 무엇인가
//   ② 성장 통계              → streak · 기억 분포(risk+shaky)
//   ③ 오늘 daily_activity    → 어떤 모듈을 실제로 손댔나
//
// ①②는 이미 `cache()` 라 같은 요청 안에서 layout·page 가 함께 써도 쿼리는 1회다.
// 여기서 새로 도는 쿼리는 ③ 하나뿐이고, 그것도 `fetchTouchedModulesToday` 가 `cache()` 라
// /hub 페이지가 같은 값을 다시 부를 때 재사용된다.

import 'server-only'

import { cache } from 'react'

import type { SupabaseClient } from '@supabase/supabase-js'

import { fetchGrowthStats } from '@/lib/learner/growth-stats'
import { fetchTodayPrescription } from '@/lib/learner/prescription-actions'
import { blockProgress, buildTodayBlocks } from '@/lib/learner/today-blocks'
import { computeTodayStatus, type TodayStatus } from '@/lib/learner/today-status'
import { createClient } from '@/lib/supabase/server'

function kstDateIso(): string {
  return new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10)
}

/** by_module 이 jsonb 라 어떤 모양이든 올 수 있다 — 0보다 큰 숫자 키만 남긴다. */
function normalizeByModule(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
  const out: string[] = []
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) out.push(k)
  }
  return out
}

/**
 * 오늘 손댄 모듈 집합 — **서버가 정본이다.**
 *
 * 이전에는 /hub 무대가 클라이언트에서 받아 온 "최근 활동 목록"(`useHubData`)으로 이 판정을
 * 했다. 그 목록은 최근 N건만 담기 때문에, 오늘 여러 모듈을 돌린 날에는 앞쪽 모듈이 목록에서
 * 밀려나 **완료가 조용히 사라진다.** 셸 띠는 같은 순간에 `daily_activity.by_module` 을 보고
 * 있었으므로 두 표면이 다른 답을 냈다.
 */
export const fetchTouchedModulesToday = cache(async (): Promise<Set<string>> => {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return new Set()

  const lc = client as unknown as SupabaseClient
  const { data: todayRow } = await lc
    .from('daily_activity')
    .select('by_module')
    .eq('user_id', user.id)
    .eq('date', kstDateIso())
    .maybeSingle()

  return new Set(normalizeByModule((todayRow as { by_module?: unknown } | null)?.by_module))
})

/**
 * 오늘 DCP(구문 연습) 문항을 풀었는가.
 *
 * `daily_activity.by_module` 에 안 남는다 — `grade_dcp_item` 이 `csat_item_attempts` 에
 * 직접 INSERT 하기 때문이다. 그래서 별도 조회가 필요하다.
 *
 * ⚠️ 한때 이 블록을 "완료 관측 불가" 로 두고 진행 분모에서 뺐다. 근거는 CLAUDE.md 의
 * "csat_item_attempts 미해결" 이었는데, 그 표가 낡아 있었다 —
 * `20260812113000_restore_csat_item_attempts` 가 이미 복원했다(실측: 테이블 존재).
 * **문서를 근거로 코드를 정하지 말 것. DB 에 물어볼 것.**
 */
export const fetchDcpDoneToday = cache(async (): Promise<boolean> => {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return false

  const lc = client as unknown as SupabaseClient
  // KST 오늘 00:00 → UTC 순간
  const startUtc = new Date(
    Math.floor((Date.now() + 9 * 3_600_000) / 86_400_000) * 86_400_000 - 9 * 3_600_000,
  ).toISOString()

  const { data } = await lc
    .from('csat_item_attempts')
    .select('id')
    .eq('user_id', user.id)
    .eq('item_role', 'practice')
    .gte('responded_at', startUtc)
    .limit(1)

  return (data?.length ?? 0) > 0
})

export const fetchTodayStatus = cache(async (): Promise<TodayStatus | null> => {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return null

  const [prescription, growth, touched, dcpDone] = await Promise.all([
    fetchTodayPrescription(),
    fetchGrowthStats(),
    fetchTouchedModulesToday(),
    fetchDcpDoneToday(),
  ])

  // 처방 계산에 실패했으면(`unavailable`) 진행을 0/0 으로 둔다. 폴백값을 "오늘 할 일" 로
  // 표기하면 실패가 정상처럼 보인다(prescription-actions 의 unavailable 주석 참조).
  const progress =
    prescription && prescription.isDiagnosed && !prescription.unavailable
      ? blockProgress(buildTodayBlocks(prescription, touched, dcpDone))
      : { done: 0, total: 0 }

  return computeTodayStatus({
    progress,
    memory: { risk: growth?.memory.risk ?? 0, shaky: growth?.memory.shaky ?? 0 },
    streak: growth?.streak ?? 0,
  })
})
