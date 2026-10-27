// apps/web/src/lib/wordvault/set-membership-query.ts
// 선택한 기사 단어장(filter=set:<id>)의 정본 낱말 목록 — 본인 세션 클라이언트(RLS)로 읽는다.
// 발행된 기사 단어장(category library_article)일 때만. 도서 장 세트·기타 필터는 null(기존 origin 판정 그대로).
// 조회 실패는 error 로 돌려준다 — 「단어 0」 이나 전체 목록으로 숨기지 않는다.
import type { SupabaseClient } from '@supabase/supabase-js'

import { normalizeSourceFilter } from './source-filter'

export type SetMembershipPayload = { setId: string; words: string[] } | { setId: string; error: true }

const PAGE = 1000

export async function loadArticleSetMembership(client: SupabaseClient, rawFilter: unknown): Promise<SetMembershipPayload | null> {
  const filter = normalizeSourceFilter(rawFilter)
  if (!filter.startsWith('set:')) return null
  const setId = filter.slice(4)
  try {
    const { data: set, error: setErr } = await client
      .from('shared_word_sets')
      .select('id, category, is_published')
      .eq('id', setId)
      .maybeSingle()
    if (setErr) throw setErr
    const s = set as { category?: string; is_published?: boolean } | null
    if (!s || s.category !== 'library_article' || s.is_published !== true) return null
    const words: string[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await client.from('shared_words').select('word').eq('set_id', setId).range(from, from + PAGE - 1)
      if (error) throw error
      const rows = (data ?? []) as Array<{ word?: unknown }>
      for (const r of rows) if (typeof r.word === 'string') words.push(r.word)
      if (rows.length < PAGE) break
    }
    return { setId, words }
  } catch {
    return { setId, error: true }
  }
}
