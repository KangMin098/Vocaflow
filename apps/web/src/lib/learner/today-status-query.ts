// apps/web/src/lib/learner/today-status-query.ts
//
// 상태 띠(StatusRibbon)의 **서버 조회부** — ADR 0006 D2.
// 순수 계산은 `today-status.ts` 에 있다. 두 파일을 나눈 이유는 그 파일 머리 주석 참조.
//
// ⚠️ v06.34 — `fetchTodayStatus` 는 **제거됐다.** 유일한 호출자였던 셸 레이아웃이
//    `fetchWayfinder`(wayfinder-query.ts)로 옮겨갔다. 남은 둘(`fetchTouchedModulesToday` ·
//    `fetchDcpDoneToday`)은 그 조회와 /hub 가 함께 쓰므로 여기 그대로 둔다.
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

/** KST 오늘 00:00 → UTC ISO — 위 두 조회가 공유한다. */
function kstTodayStartUtcIso(): string {
  return new Date(
    Math.floor((Date.now() + 9 * 3_600_000) / 86_400_000) * 86_400_000 - 9 * 3_600_000,
  ).toISOString()
}

/**
 * 오늘 읽었는가 — **`daily_activity.by_module` 에 안 남는다.**
 *
 * `BLOCK_MODULES.read` 는 `['textviewer', 'workspace']` 인데, 저장소 어디에도 그 키로
 * `learning_records` 에 쓰는 코드가 없다(읽기 표면은 학습 기록을 남기지 않는다).
 * 실측 2026-09-05 — `by_module` 에 실제로 나타난 키 21종에 둘 다 없다:
 *   dictation · ghost-race · cascade · wordblitz · echo · flashcard · word-economy …
 *
 * 그래서 읽기 블록은 **완료가 구조적으로 불가능**했고, `pickNow()` 의 순서가
 * review→listen→**read**→syntax→check 라 복습·듣기를 끝내면 "지금 할 일" 이 **읽기에서
 * 영구히 멈췄다.** 지문을 읽고 돌아와도 여전히 읽기였고, 구문·검증은 차례가 오지 않았다.
 *
 * 읽었다는 증거는 `reading_sessions` 에 있다(실측 256행). 거기서 읽는다.
 */
export const fetchReadDoneToday = cache(async (): Promise<boolean> => {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return false

  const lc = client as unknown as SupabaseClient
  const { data } = await lc
    .from('reading_sessions')
    .select('id')
    .eq('user_id', user.id)
    .gte('started_at', kstTodayStartUtcIso())
    .limit(1)

  return (data?.length ?? 0) > 0
})

/**
 * 오늘 ScriptQuiz 를 풀었는가 — 같은 이유로 별도 조회다.
 *
 * `BLOCK_MODULES.check` 는 `['scriptquiz']` 인데 ScriptQuiz 는 완주 결과를
 * `recordGameScore` 로 **`scores`** 에만 쓴다(`ScriptQuiz.tsx`). `learning_records` 를
 * 안 쓰므로 `by_module` 에 'scriptquiz' 가 영영 안 생긴다 — 실측 `scores` 에는 23행 있다.
 */
export const fetchCheckDoneToday = cache(async (): Promise<boolean> => {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return false

  const lc = client as unknown as SupabaseClient
  const { data } = await lc
    .from('scores')
    .select('id')
    .eq('user_id', user.id)
    .eq('module', 'scriptquiz')
    .gte('created_at', kstTodayStartUtcIso())
    .limit(1)

  return (data?.length ?? 0) > 0
})
