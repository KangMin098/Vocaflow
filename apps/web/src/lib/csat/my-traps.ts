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

// ─────────────────────────────────────────────────────────────────────
// 훈련으로 되먹이기 — **기록이 다음 세트를 고른다** (원칙 2 · 간격 반복)
// ─────────────────────────────────────────────────────────────────────

/** 틀린 문제가 다시 나오기까지의 최소 간격(시간). 방금 본 해설을 기억으로 맞히면 인출이 아니다. */
export const RETURN_AFTER_HOURS = 24

export interface AttemptRow {
  item_id: string
  choice: number
  is_correct: boolean
  answered_at: string
}

/**
 * 다시 낼 카드 id — **가장 최근 시도가 오답**이고 그 시도가 `afterHours` 이상 지난 것.
 *
 * 순수 함수다(`now` 를 받는다). 규칙이 둘뿐이지만 둘 다 틀리기 쉽다:
 *   · **가장 최근 시도로** 본다 — 한 번 틀리고 나중에 맞혔으면 다시 낼 이유가 없다.
 *     「틀린 적이 있다」로 고르면 이미 익힌 문제가 끝없이 돌아온다.
 *   · **오래 기다린 것부터** — 가장 오래된 오답이 가장 잊히기 쉽다.
 */
export function returningCardIds(rows: AttemptRow[], now: Date, afterHours = RETURN_AFTER_HOURS): string[] {
  const latest = new Map<string, AttemptRow>()
  for (const r of rows) {
    const key = `${r.item_id}:${r.choice}`
    const prev = latest.get(key)
    if (!prev || Date.parse(r.answered_at) > Date.parse(prev.answered_at)) latest.set(key, r)
  }
  const cutoff = now.getTime() - afterHours * 3600_000
  return [...latest.entries()]
    .filter(([, r]) => !r.is_correct && Date.parse(r.answered_at) <= cutoff)
    // 시각은 **파싱해서** 견준다 — 문자열로 견주면 형식이 한 번만 달라져도(공백 대 T, 소수 자릿수)
    // 순서가 조용히 뒤집힌다.
    .sort((a, b) => Date.parse(a[1].answered_at) - Date.parse(b[1].answered_at) || (a[0] < b[0] ? -1 : 1))
    .map(([key]) => key)
}

export interface DrillBiasInput {
  weak: string[]
  returning: string[]
}

/**
 * 훈련 세트에 넘길 편향을 만든다.
 *
 * ⚠️ 두 신호의 문턱이 **다르다** — 한데 묶으면 말할 수 있는 것도 못 말한다:
 *   · 되돌아오는 문제는 **특정 카드를 다시 묻는 것**이지 분포에 대한 주장이 아니다.
 *     그래서 기록이 얇아도 낸다.
 *   · 자주 놓치는 수법은 **분포에 대한 주장**이다. 그래서 `enough` 를 넘어야만 넘긴다 —
 *     다섯 문항으로 세트를 기울이면 개인화가 아니라 잡음을 키우는 것이다.
 */
export function drillBias(summary: MyTrapSummary, returning: string[]): DrillBiasInput | null {
  const weak = summary.enough ? summary.repeated : []
  if (!weak.length && !returning.length) return null
  return { weak, returning }
}

/** 내 훈련 기록의 시도 행 — 되돌아올 카드를 고르는 데만 쓴다. */
export async function loadMyAttempts(db: SupabaseClient, limit = 500): Promise<AttemptRow[]> {
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return []
  const { data, error } = await db
    .from('csat_trap_attempts')
    .select('item_id, choice, is_correct, answered_at')
    .eq('user_id', user.id)
    .order('answered_at', { ascending: false })
    .limit(limit)
  // 못 읽으면 되돌아오는 문제 없이 뽑는다 — 훈련은 기록 없이도 돌아야 한다.
  if (error) return []
  return (data ?? []) as AttemptRow[]
}
