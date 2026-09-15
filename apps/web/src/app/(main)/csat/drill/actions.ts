// apps/web/src/app/(main)/csat/drill/actions.ts
//
// **훈련 기록을 남긴다** — ④「내가 되풀이해 걸리는 수법」의 입력구.
//
// ── 문제 단위로 쓴다, 세트 단위가 아니라 ──────────────────────────────
// 끝까지 푼 세트만 기록하면 **중간에 그만둔 사람이 통째로 사라진다.** 그 사람이야말로
// 훈련이 어려웠거나 지루했던 사람이라 가장 알아야 할 대상이다. 그래서 답할 때마다 한 행.
//
// ── 실패해도 훈련을 막지 않는다 ───────────────────────────────────────
// 기록이 안 되는 것과 문제를 못 푸는 것은 다르다. 쓰기가 실패하면 **조용히 지나가고**
// 화면은 다음 문제로 간다 — 다만 `ok:false` 를 돌려주므로 화면이 「이번 기록은 저장되지
// 않았어요」를 말할 수 있다. 던지지 않는 이유는 그것이 세트 전체를 끊기 때문이다.
//
// ⚠️ **`user_id` 를 화면에서 받지 않는다.** 세션에서 읽는다 — 클라이언트가 보낸 id 를 믿으면
//    남의 기록을 쓸 수 있다. RLS 의 `with check (auth.uid() = user_id)` 가 2차로 막지만,
//    1차를 코드에 두는 편이 실수를 구조적으로 없앤다.

'use server'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

export type RecordResult = { ok: true } | { ok: false; reason: 'unauthenticated' | 'error' }

/** 훈련 한 문제의 답을 남긴다. 실패해도 던지지 않는다 — 부르는 쪽이 계속 갈 수 있게. */
export async function recordTrapAttempt(input: {
  itemId: string
  choice: number
  answerTrap: string
  pickedTrap: string
}): Promise<RecordResult> {
  // ⚠️ 제네릭을 푼다. `@vocaflow/types` 의 `Database` 는 스키마에서 생성되므로 마이그레이션
  //    `20260916021500` 적용 전 타입에는 `csat_trap_attempts` 가 없다. `learner.ts` 가
  //    `csat_*` 에 대해 쓰는 것과 같은 완화이고, **완화 지점을 이 한 줄로 모은다** —
  //    타입을 다시 생성하면 이 줄만 되돌리면 전 경로가 다시 검사된다.
  const db = (await createClient()) as unknown as SupabaseClient
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return { ok: false, reason: 'unauthenticated' }

  // 값은 전부 구운 풀에서 온 것이지만, 화면을 거쳐 오므로 모양만 다시 본다.
  const choice = Number.isFinite(input.choice) ? Math.trunc(input.choice) : 0
  if (!input.itemId || choice < 1 || choice > 5) return { ok: false, reason: 'error' }
  if (!input.answerTrap || !input.pickedTrap) return { ok: false, reason: 'error' }

  const { error } = await db.from('csat_trap_attempts').insert({
    user_id: user.id,
    item_id: input.itemId,
    choice,
    answer_trap: input.answerTrap.slice(0, 80),
    picked_trap: input.pickedTrap.slice(0, 80),
  })
  if (error) return { ok: false, reason: 'error' }
  return { ok: true }
}
