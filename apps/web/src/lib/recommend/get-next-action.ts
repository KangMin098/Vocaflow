// apps/web/src/lib/recommend/get-next-action.ts
//
// 실 추천 — 사용자 상태 기반 (server action). getMockNextAction 의 DB 연동 대체.
// 컨텍스트: due 단어 수(P1) + 본인이 열어 둔 개인 글(P2 · own-reading) + mastery(user_stats 또는 vocab 수 근사, P3).
// P2 는 라이브러리 도서 · 기사 · 묶음을 아직 넣지 않는다(권리 · 발행 조건이 따로다). 조회는 SELECT 만 — 상태를 고치지 않는다.

'use server'

import type { MasteryLevel } from '@/lib/srs'
import { createClient } from '@/lib/supabase/server'

import { decideNextAction } from './decide'
import { pickOwnInProgressText, type OwnTextRow } from './own-reading'
import type { OwnedNextAction, RecommendedAction } from './types'

const COLD_START: RecommendedAction = { module: 'library', label: '새 스크립트를 만나보세요' }

const COLD: OwnedNextAction = { action: COLD_START, fallback: COLD_START, personal: false, ownerId: null }

type ServerClient = Awaited<ReturnType<typeof createClient>>

/** 한 번에 읽는 후보 수 — 상한이 아니라 쪽 크기다. 부적격 행이 한 쪽을 채워도 다음 쪽을 읽는다(Codex R01). */
const PAGE = 20

/**
 * 본인이 열어 둔 개인 글 하나 — 서버에서 걸 수 있는 조건은 쪽 나누기 **전에** 건다(도서 · 묶음 · 출처 표지 · 제목 없음).
 * 정렬은 pickOwnInProgressText 와 같다: updated_at 최신(NULL 은 맨 뒤) → id 오름차순(Codex R02 · 쪽 경계에서도 순서가 같다).
 * 쪽마다 앞에서부터 고르므로 첫 적격 행이 곧 전체의 첫 적격 행이다. 실패하면 'error' — 「없음」으로 바꿔 말하지 않는다.
 */
async function findOwnInProgressText(client: ServerClient, userId: string) {
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from('texts')
      .select('id, title, user_id, status, source_url, library_book_id, user_book_group_id, updated_at')
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .is('library_book_id', null)
      .is('user_book_group_id', null)
      .or('source_url.is.null,source_url.eq.')
      .not('title', 'is', null)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) return 'error' as const
    const rows = (data ?? []) as OwnTextRow[]
    const pick = pickOwnInProgressText(rows, userId)
    if (pick) return pick
    if (rows.length < PAGE) return null
  }
}

export async function getNextActionForUser(): Promise<OwnedNextAction> {
  try {
    const client = await createClient()
    const {
      data: { user },
    } = await client.auth.getUser()
    if (!user) return COLD

    const nowIso = new Date().toISOString()
    const [totalRes, dueRes, statsRes, ownRes] = await Promise.all([
      client.from('vocabularies').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      client
        .from('vocabularies')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .lte('next_review_at', nowIso),
      client.from('user_stats').select('mastery_level, current_streak').eq('user_id', user.id).maybeSingle(),
      findOwnInProgressText(client, user.id),
    ])

    const total = totalRes.count ?? 0
    // mastery: user_stats 우선, 없으면 보유 단어 수로 근사(빈 테이블 안전)
    const stored = (statsRes.data?.mastery_level as MasteryLevel | null) ?? null
    const mastery: MasteryLevel = stored ?? (total < 50 ? 'cold' : total < 300 ? 'warm' : 'hot')

    const base = { masteryLevel: mastery, urgentWordCount: dueRes.count ?? 0 }
    // 조회 실패면 P2 없이 — 「진행 중 글 없음」으로 바꿔 말하지 않고 그냥 다른 추천으로 간다
    const own = ownRes === 'error' ? null : ownRes
    const fallback = decideNextAction(base)
    const action = own ? decideNextAction({ ...base, inProgressTextTitle: own.title, inProgressTextId: own.id }) : fallback
    return { action, fallback, personal: action.module === 'workspace' && !!action.textId, ownerId: user.id }
  } catch {
    return COLD
  }
}
