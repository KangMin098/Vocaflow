// apps/web/src/lib/library/__tests__/article-vocab.integration.test.ts
//
// **글 상세의 단어장 섹션이 조용히 사라지는 것**을 잡는다.
//
// 이 섹션은 `vocab && (…)` 이라, 쿼리가 0행을 주면 **페이지는 200 으로 멀쩡히 나오고
// 섹션만 없다.** 상태 코드로도, 바이트 수로도 알 수 없다 — 공유 카드가 빈 카드로 나갔을 때와
// 같은 모양의 실패다. 그래서 화면이 쓰는 바로 그 함수를 **anon 권한으로** 실제로 부른다.
//
// 여기서 확인하는 것은 셋이다:
//   1. 익명이 세트를 읽을 수 있는가 — RLS 의 `read published` 가 `library_article` 을 열어 준다
//   2. 익명이 그 세트의 **낱말**까지 읽을 수 있는가 — 세트만 열리고 낱말이 막히면 빈 목록이 된다
//   3. 잇는 키가 살아 있는가 — `curation_query->>article_id` 는 컬럼이 아니라 jsonb 안이다.
//      큐레이션이 이 키 이름을 바꾸면 `contains` 가 조용히 0행이 된다
//
// 환경변수 없으면 skip — CI 정상.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import { fetchArticleVocabPreview, VOCAB_SAMPLE_LIMIT } from '../article-vocab'

const URL_BASE = process.env['NEXT_PUBLIC_SUPABASE_URL']
const ANON = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
const skipIfNoEnv = !URL_BASE || !ANON

/** 화면의 비로그인 방문자와 **같은 권한**. 여기서 되는 것만 검색으로 온 사람이 본다. */
function anonClient(): SupabaseClient {
  return createClient(URL_BASE as string, ANON as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** 세트가 있는 발행 글 하나를 anon 으로 고른다 — 표본도 익명이 볼 수 있는 것이어야 한다. */
async function pickArticleWithSet(
  db: SupabaseClient,
): Promise<{ articleId: string } | null> {
  const { data } = await db
    .from('shared_word_sets')
    .select('curation_query')
    .eq('is_published', true)
    .eq('category', 'library_article')
    .limit(1)

  const q = (data as Array<{ curation_query: { article_id?: string } }> | null)?.[0]?.curation_query
  return q?.article_id ? { articleId: q.article_id } : null
}

describe.skipIf(skipIfNoEnv)('글 상세의 단어장 (실 DB · anon)', () => {
  it('익명이 발행 글의 세트를 읽는다 — 0이면 섹션이 전부 사라진 것이다', async () => {
    const db = anonClient()
    const { count, error } = await db
      .from('shared_word_sets')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', true)
      .eq('category', 'library_article')

    expect(error, `세트 조회가 거부됐다: ${error?.message ?? ''}`).toBeNull()
    // `count ?? 0` 을 쓰지 않는다 — 없는 표도 head 요청엔 count=null 을 준다.
    expect(count, 'anon 에게 library_article 세트가 하나도 안 열린다 — RLS 를 볼 것').not.toBeNull()
    expect(count as number).toBeGreaterThan(0)
  })

  it('화면이 부르는 함수가 실제로 미리보기를 준다', async () => {
    const db = anonClient()
    const picked = await pickArticleWithSet(db)
    expect(picked, 'anon 으로 세트 달린 글을 하나도 못 찾았다').not.toBeNull()

    const preview = await fetchArticleVocabPreview(db, (picked as { articleId: string }).articleId)

    expect(
      preview,
      'curation_query 의 article_id 로 되짚어지지 않는다 — 키 이름이 바뀌었을 수 있다',
    ).not.toBeNull()
    expect((preview as NonNullable<typeof preview>).title.length).toBeGreaterThan(0)
  })

  it('낱말까지 온다 — 세트만 열리고 낱말이 막히면 빈 목록이 그려진다', async () => {
    const db = anonClient()
    const picked = await pickArticleWithSet(db)
    const preview = await fetchArticleVocabPreview(db, (picked as { articleId: string }).articleId)
    const p = preview as NonNullable<typeof preview>

    expect(p.samples.length, 'shared_words 가 anon 에게 막혔다').toBeGreaterThan(0)
    expect(p.samples.length).toBeLessThanOrEqual(VOCAB_SAMPLE_LIMIT)
    expect(p.samples.every((w) => w.word.length > 0)).toBe(true)
  })

  it('없는 글에는 null — 조건 없이 아무 세트나 집어오지 않는다', async () => {
    const db = anonClient()
    const preview = await fetchArticleVocabPreview(
      db,
      '00000000-0000-0000-0000-000000000000',
    )
    expect(preview, 'article_id 필터가 듣지 않는다 — 남의 단어장을 그릴 수 있다').toBeNull()
  })
})
