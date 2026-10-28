// apps/web/src/lib/learner/reader-article-practice-actions.ts
// R0 — Reader 의 연습 조회가 실패했을 때 「다시 시도」 : layout 과 같은 단일 호출(article_practice_items) 1회(T-0204).
// 문항 payload 는 돌려주지 않는다 — 상태와 주소만. 권한·관문은 RPC 가 auth.uid() 로 다시 본다(이 action 이 넓히지 않는다).

'use server'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

import { classifyPracticeLookup, isPracticeArticleId, type ReaderArticlePractice } from './reader-article-practice'

export async function recheckReaderArticlePractice(articleId: unknown): Promise<ReaderArticlePractice> {
  if (!isPracticeArticleId(articleId)) return { state: 'none' }
  try {
    const client = (await createClient()) as unknown as SupabaseClient
    const res = await client.rpc('article_practice_items', { p_article_id: articleId })
    return classifyPracticeLookup(articleId, res)
  } catch {
    return { state: 'failed', articleId }
  }
}
