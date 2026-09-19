// apps/web/src/lib/textbook/my-shelf-actions.ts
//
// 교재 담기/빼기 — 서버 액션.
//
// 저장하는 것은 **step 번호 하나**다. 권의 제목·학령·유형은 `SERIES_SPINE` 이 소유하므로
// 복사하지 않는다 — 복사하면 시리즈를 고칠 때 DB 가 낡은 이름을 계속 말한다.
//
// 실패를 삼키지 않는다. 화면이 "담았다" 고 말했는데 실제로 안 담긴 것이 가장 나쁘다.

'use server'

import { revalidatePath } from 'next/cache'

import type { SupabaseClient } from '@supabase/supabase-js'

// 시리즈 정본 — 자유 문자열을 그대로 넣으면 담김이 어느 서가에도 안 보이는 행으로 남는다.
import { SERIES_CATALOG } from '@vocaflow/library-pipeline/textbook-series-catalog'

import { createClient } from '@/lib/supabase/server'

export interface ToggleResult {
  ok: boolean
  /** 실패 사유 — 화면이 그대로 보여 준다(조용히 아무 일도 안 일어나면 안 된다). */
  error?: string
}

/**
 * 담김 상태를 보여주는 화면 전부를 무효화한다.
 *
 * ⚠️ `'/library/textbooks'` 만 부르면 **권 상세(`[step]`)가 안 딸려 온다.** 서가에서 담고
 *    상세로 넘어가면 거기만 예전 상태를 보여준다 — 같은 것을 두 화면이 다르게 말하는 상태다.
 *    `'layout'` 범위로 불러야 자식 라우트까지 걸린다.
 */
function revalidateShelf() {
  revalidatePath('/library/textbooks', 'layout')
  revalidatePath('/text')
}

async function userClient() {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  return { lc: client as unknown as SupabaseClient, userId: user?.id ?? null }
}

/**
 * 담는다 — **어느 시리즈의** 그 단인가.
 *
 * ⚠️ `series` 가 없던 동안 PK 가 `(user_id, step)` 이라 **어휘 5단과 독해 5단이 같은 행**이었다.
 *   어휘 권을 담으면 독해를 담은 것으로 기록되고, 하나를 빼면 둘이 같이 빠졌다
 *   (마이그레이션 `20260912221500`). 기본값은 독해다 — 옛 호출부가 그것을 기대한다.
 *
 * ⚠️ **카탈로그에 없는 시리즈는 거절한다.** 자유 문자열을 그대로 넣으면 담김이 어느 서가에도
 *   안 보이는 행으로 남는다(조판기에서 같은 모양의 사고를 고쳤다 — `volume-target.ts`).
 */
export async function addTextbook(step: number, series = 'reading'): Promise<ToggleResult> {
  if (!Number.isInteger(step) || step < 1) return { ok: false, error: '잘못된 교재입니다.' }
  if (!SERIES_CATALOG.some((s) => s.id === series)) {
    return { ok: false, error: '잘못된 교재입니다.' }
  }
  const { lc, userId } = await userClient()
  if (!userId) return { ok: false, error: '로그인이 필요해요.' }

  const { error } = await lc
    .from('user_textbook_selections')
    .upsert({ user_id: userId, series, step }, { onConflict: 'user_id,series,step' })

  if (error) return { ok: false, error: '지금은 담을 수 없어요. 잠시 뒤 다시 시도해 주세요.' }
  revalidateShelf()
  return { ok: true }
}

export async function removeTextbook(step: number, series = 'reading'): Promise<ToggleResult> {
  if (!Number.isInteger(step) || step < 1) return { ok: false, error: '잘못된 교재입니다.' }
  if (!SERIES_CATALOG.some((s) => s.id === series)) {
    return { ok: false, error: '잘못된 교재입니다.' }
  }
  const { lc, userId } = await userClient()
  if (!userId) return { ok: false, error: '로그인이 필요해요.' }

  const { error } = await lc
    .from('user_textbook_selections')
    .delete()
    .eq('user_id', userId)
    // ⚠️ 시리즈를 안 걸면 **다른 시리즈의 같은 단까지 빠진다.**
    .eq('series', series)
    .eq('step', step)

  if (error) return { ok: false, error: '지금은 뺄 수 없어요. 잠시 뒤 다시 시도해 주세요.' }
  revalidateShelf()
  return { ok: true }
}
