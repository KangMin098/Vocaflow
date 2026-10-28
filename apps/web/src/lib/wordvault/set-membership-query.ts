// apps/web/src/lib/wordvault/set-membership-query.ts
// 선택한 기사 단어장(filter=set:<id>)의 정본 낱말 목록 — 본인 세션 클라이언트(RLS)로 읽는다.
// 발행된 기사 단어장(category library_article)이고 **부모 기사도 발행·한국 권리 안전**일 때만(관리자 세션이 RLS 로
// 더 읽을 수 있어도 공개 학습 관계로 내주지 않는다). 도서 장 세트·기타 필터는 null(기존 origin 판정 그대로).
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
      .select('id, category, is_published, curation_query')
      .eq('id', setId)
      .maybeSingle()
    if (setErr) throw setErr
    const s = set as { category?: string; is_published?: boolean; curation_query?: { article_id?: unknown } | null } | null
    if (!s || s.category !== 'library_article' || s.is_published !== true) return null
    const articleId = s.curation_query?.article_id
    if (typeof articleId !== 'string') return null
    const { data: art, error: artErr } = await client
      .from('library_articles')
      .select('status, copyright_safe_in_kr')
      .eq('id', articleId)
      .maybeSingle()
    if (artErr) throw artErr
    const a = art as { status?: string; copyright_safe_in_kr?: boolean } | null
    if (!a || a.status !== 'published' || a.copyright_safe_in_kr !== true) return null
    const words: string[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await client.from('shared_words').select('id, word').eq('set_id', setId).order('id').range(from, from + PAGE - 1)
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
