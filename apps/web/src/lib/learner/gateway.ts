// apps/web/src/lib/learner/gateway.ts
//
// 관문(/hub) 상태 **조회부**. 판정·문구는 `gateway-state.ts`(순수)가 소유한다.
//
// 마지막 활동을 어디서 읽나 — 두 곳을 합친다:
//   · `learning_records` — 단어 단위 학습(506행 실측). `vocabularies.text_id → texts.title`
//   · `scores`           — 세션/게임 단위(63행 실측). `text_id → texts.title`
// 한쪽만 보면 조용히 틀린다: 받아쓰기·게임은 scores 에, 플래시카드류는 learning_records 에
// 남기 때문에 **마지막에 한 것**이 어느 쪽인지 미리 알 수 없다.
//
// ⚠️ `reading_sessions` 는 쓰지 않는다. 이어하기의 정본처럼 보이지만(text_id ·
//    start_paragraph_idx · status) **실제로는 채워지지 않는다** — 실측 2026-08-16:
//    전 사용자 256행이 전부 `status='pending'` 이고 `started_at` 이 **전부 NULL** 이다.
//    "계획만 세워지고 시작 기록이 없는" 테이블이라, 이것으로 이어하기를 만들면
//    항상 첫 문단으로 되돌린다. 기록되지 않는 값은 쓰지 않는다(같은 세션에서
//    `daily_activity.total_minutes` 로 배운 교훈).

import 'server-only'

import { cache } from 'react'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

import { classifyGateway, type GatewayState, type LastTouch } from './gateway-state'

export type { GatewayPhase, GatewayState, LastTouch } from './gateway-state'

/**
 * 중첩 조인 결과를 하나로 편다.
 *
 * ⚠️ PostgREST 는 다대일 조인을 **객체**로 주는데 생성된 타입(`database.ts`)은 **배열**로
 * 선언한다. 어느 한쪽만 가정하면 조용히 `undefined` 가 되어 제목이 사라진다 —
 * 화면은 멀쩡히 뜨고 "마지막에 뭘 했는지" 만 안 보이는, 이 리포가 가장 자주 겪은 종류의 결함이다.
 * 그래서 둘 다 받는다.
 */
function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

/** 텍스트로 돌아가는 경로. 모듈에 따라 진입면이 다르다. */
function hrefFor(module: string, textId: string | null): string | null {
  if (!textId) return null
  // ⚠️ 이름이 어긋나 있었다 — 여기서는 `?textId=` 를 보냈는데 받는 쪽
  //    (`DictationSetupClient`)이 읽는 것은 `text`·`set`·`custom`·`chapter` 다.
  //    그래서 "이어서 받아쓰기" 를 눌러도 **자료가 안 실린 빈 준비 화면**이 열렸고,
  //    학습자는 방금 읽던 글을 다시 골라야 했다(실측 2026-08-30 · 오류는 나지 않는다).
  if (module === 'dictation') return `/dictate/setup?text=${textId}`
  if (module === 'echo') return `/text/${textId}/echo`
  if (module === 'scriptquiz') return `/scriptquiz`
  return `/text/${textId}`
}

export const fetchGatewayState = cache(async (): Promise<GatewayState> => {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return classifyGateway(null)

  const lc = client as unknown as SupabaseClient

  const [{ data: lr }, { data: sc }] = await Promise.all([
    lc
      .from('learning_records')
      .select('module, attempted_at, vocabularies(text_id, texts(title))')
      .eq('user_id', user.id)
      .order('attempted_at', { ascending: false })
      .limit(1),
    lc
      .from('scores')
      .select('module, created_at, text_id, texts(title)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  const candidates: LastTouch[] = []

  type Titled = { title: string | null } | { title: string | null }[] | null
  type LrRow = {
    module: string | null
    attempted_at: string
    vocabularies: { text_id: string | null; texts: Titled } | { text_id: string | null; texts: Titled }[] | null
  }
  type ScRow = {
    module: string | null
    created_at: string
    text_id: string | null
    texts: Titled
  }

  const lrRow = ((lr ?? []) as unknown as LrRow[])[0]
  if (lrRow?.module) {
    const vocab = one(lrRow.vocabularies)
    const textId = vocab?.text_id ?? null
    candidates.push({
      module: lrRow.module,
      title: one(vocab?.texts)?.title ?? null,
      href: hrefFor(lrRow.module, textId),
      at: lrRow.attempted_at,
    })
  }

  const scRow = ((sc ?? []) as unknown as ScRow[])[0]
  if (scRow?.module) {
    candidates.push({
      module: scRow.module,
      title: one(scRow.texts)?.title ?? null,
      href: hrefFor(scRow.module, scRow.text_id),
      at: scRow.created_at,
    })
  }

  if (candidates.length === 0) return classifyGateway(null)

  // 더 최근 것이 "마지막에 하던 것" 이다.
  candidates.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  return classifyGateway(candidates[0])
})
