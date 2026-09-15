// apps/web/src/lib/csat/my-traps.ts
//
// **「나는 어느 수법에 되풀이해 걸리는가」 — 내 기록의 순수 모델 + 로더.**
//
// ── 이 화면이 말해도 되는 것과 안 되는 것 ─────────────────────────────
// 훈련 기록이 쌓이면 유혹이 생긴다: 막대 아홉 개를 그려 「당신의 약점은 인과 역전입니다」라고
// 적는 것. **표본이 얇으면 그건 거짓말이다.** 세 번 만난 함정에서 두 번 틀린 것과, 스무 번
// 만나 열네 번 틀린 것은 같은 66%가 아니다. 그런데 화면은 둘 다 66%로 그린다.
//
// 그래서 문턱을 코드에 박고, 넘기 전에는 **배수를 말하지 않는다**:
//   · 함정 하나에 대해 말하려면 그 함정을 **`MIN_SEEN` 번 이상** 만나야 한다
//   · 전체를 「분포」라고 부르려면 시도가 **`MIN_TOTAL` 번 이상**이어야 한다
// 문턱 아래에서는 **센 것만** 보여 준다(몇 번 봤고 몇 번 틀렸는지). 그것은 사실이다.
//
// ⚠️ **`server-only` 를 들이지 않는다** — 타입과 순수 함수를 화면이 읽는다.
//    DB 를 만지는 것은 `loadMyTraps` 하나뿐이고 그건 서버에서만 불린다.

import type { SupabaseClient } from '@supabase/supabase-js'

import { baselineShare } from './trap-atlas'

/** 한 함정에 대해 말하려면 이만큼은 만나야 한다. */
export const MIN_SEEN = 3
/** 「분포」라고 부르려면 시도가 이만큼은 있어야 한다. */
export const MIN_TOTAL = 20

export interface MyTrap {
  trap: string
  seen: number
  missed: number
  /** 내 오답 중 이 함정이 차지하는 몫 (0~1). 오답이 0이면 0. */
  share: number
  /**
   * 전체 기출 오답 분포 대비 배수. **문턱을 못 넘으면 `null`** — 화면은 그때 아무 말도 안 한다.
   */
  lift: number | null
}

export interface MyTrapSummary {
  total: number
  correct: number
  missedTotal: number
  rows: MyTrap[]
  /** 「분포」라고 불러도 되는가 */
  enough: boolean
  /** 문턱을 넘어 **되풀이해 걸린다**고 말할 수 있는 함정 */
  repeated: string[]
}

export interface MyAttempt {
  answer_trap: string
  is_correct: boolean
}

/**
 * 내 기록을 함정별로 접는다. **순수 함수다** — 검사가 쉬운 자리에 판단을 둔다.
 */
export function summarizeMyTraps(attempts: MyAttempt[]): MyTrapSummary {
  const by = new Map<string, { seen: number; missed: number }>()
  for (const a of attempts) {
    const e = by.get(a.answer_trap) ?? { seen: 0, missed: 0 }
    e.seen += 1
    if (!a.is_correct) e.missed += 1
    by.set(a.answer_trap, e)
  }

  const total = attempts.length
  const missedTotal = attempts.filter((a) => !a.is_correct).length
  const base = baselineShare()
  const enough = total >= MIN_TOTAL

  const rows: MyTrap[] = [...by.entries()]
    .map(([trap, e]) => {
      const share = missedTotal > 0 ? e.missed / missedTotal : 0
      const b = base.get(trap)
      // 배수는 **둘 다** 문턱을 넘어야 말한다 — 하나만 넘으면 여전히 짐작이다.
      const lift = enough && e.seen >= MIN_SEEN && b && b > 0 && missedTotal > 0 ? share / b : null
      return { trap, seen: e.seen, missed: e.missed, share, lift }
    })
    .sort((a, b) => b.missed - a.missed || b.seen - a.seen || (a.trap < b.trap ? -1 : 1))

  return {
    total,
    correct: total - missedTotal,
    missedTotal,
    rows,
    enough,
    // 「되풀이해 걸린다」 = 충분히 만났고, 그중 절반 넘게 놓쳤다. 한 번 틀린 것은 여기 안 든다.
    repeated: rows.filter((r) => r.seen >= MIN_SEEN && r.missed * 2 > r.seen).map((r) => r.trap),
  }
}

/** 화면이 지도에 「나」 칩을 그릴 때 쓰는 값 — 함정별 **놓친 횟수**. */
export function myMissCounts(s: MyTrapSummary): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of s.rows) if (r.missed > 0) out[r.trap] = r.missed
  return out
}

/**
 * 내 훈련 기록을 읽는다.
 *
 * ⚠️ RLS 가 자기 행만 열어 주므로 `user_id` 로 거르지 않아도 남의 것은 안 온다. 그래도
 *    **명시적으로 거른다** — 정책이 넓어지는 날 이 함수가 조용히 남의 기록을 세지 않게.
 */
export async function loadMyTraps(db: SupabaseClient, limit = 500): Promise<MyTrapSummary> {
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return summarizeMyTraps([])

  const { data, error } = await db
    .from('csat_trap_attempts')
    .select('answer_trap, is_correct')
    .eq('user_id', user.id)
    .order('answered_at', { ascending: false })
    .limit(limit)

  // 못 읽은 것과 기록이 없는 것은 화면에서 같게 보인다 — 여기서는 구별할 필요가 없다.
  // 「기록이 없다」와 「못 읽었다」를 가르는 것은 훈련을 막지 않으므로 값이 적다.
  if (error) return summarizeMyTraps([])
  return summarizeMyTraps((data ?? []) as MyAttempt[])
}
