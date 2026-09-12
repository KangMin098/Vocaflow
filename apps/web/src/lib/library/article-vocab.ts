// apps/web/src/lib/library/article-vocab.ts
//
// **글 하나에 딸린 단어장** 을 읽는다 — 글 상세(공개)와 회귀가 **같은 쿼리**를 쓰도록.
//
// ── 왜 화면 밖으로 뺐나 ──────────────────────────────────────────────
// 공유 카드가 `source_archive`(RPC 가 매핑한 이름)로 select 해서 빈 카드를 내보낸 적이 있다.
// 상태 200 · 유효한 PNG 라 **열어 보기 전에는 알 수 없는 실패**였다. 그래서 그때 쿼리를
// `lib/seo/og-queries.ts` 로 모았다. 여기도 같은 이유다 — 필터가 틀리면 섹션이 조용히
// 사라질 뿐, 페이지는 200 으로 잘 나온다.
//
// ── 이 데이터가 왜 화면에 없었나 ─────────────────────────────────────
// 발행 글 160개 중 **135개**에 자동 생성 세트가 있다(낱말 3,656개). 그런데 그 세트는
// 공용 카탈로그에서 **일부러 제외**된다 — `lib/library/vocab/queries.ts` 가
// `library_book`·`library_article` 두 카테고리를 `.neq()` 로 뺀다("소스 종속 자동생성
// 세트는 각 소스 컨텍스트에서만"). 도서는 그 컨텍스트가 있다(도서 상세의 챕터 세트).
// **글은 없었다** — 로그인 뒤 학습 화면뿐이라 비로그인 방문자는 볼 곳이 없었다.
//
// RLS 는 이미 열려 있었다: `shared_word_sets`·`shared_words` 의 `read published` 정책이
// `library_article` 세트를 **그 글이 published + copyright_safe_in_kr 일 때** 익명에게 준다.
// 데이터도 정책도 준비됐고 화면만 없던 자리다.
//
// ⚠️ 클라이언트를 인자로 받는다. 화면은 서버 클라이언트를, 회귀는 순수 anon 클라이언트를
//    넘긴다 — 회귀가 `next/headers` 없이 **같은 쿼리를** 실제로 날려 볼 수 있어야 한다.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ArticleVocabPreview {
  setId: string
  title: string
  wordCount: number
  samples: Array<{ word: string; meaningKo: string | null }>
}

/** 미리보기에 실을 낱말 수. 표본이면 충분하다 — 전체는 학습 화면의 몫. */
export const VOCAB_SAMPLE_LIMIT = 6

/**
 * 발행 글의 단어장 한 건. 없으면 `null`(발행 글 160개 중 25개는 세트가 없다).
 *
 * 세트와 글을 잇는 키는 컬럼이 아니라 `curation_query` jsonb 안의 `article_id` 다
 * (`{ cap, filter, selection, article_id }`). 그래서 `eq` 가 아니라 `contains` 다.
 */
export async function fetchArticleVocabPreview(
  db: SupabaseClient,
  articleId: string,
): Promise<ArticleVocabPreview | null> {
  const { data: sets } = await db
    .from('shared_word_sets')
    .select('id, title, word_count')
    .eq('is_published', true)
    .eq('category', 'library_article')
    .contains('curation_query', { article_id: articleId })
    .limit(1)

  const set = (sets as Array<{ id: string; title: string; word_count: number | null }> | null)?.[0]
  if (!set) return null

  // 정렬 순서대로 — 무작위면 요청마다 달라져 하루짜리 캐시와 어긋난다.
  const { data: words } = await db
    .from('shared_words')
    .select('word, meaning_ko')
    .eq('set_id', set.id)
    .order('sort_order', { ascending: true })
    .limit(VOCAB_SAMPLE_LIMIT)

  return {
    setId: set.id,
    title: set.title,
    wordCount: set.word_count ?? 0,
    samples: ((words as Array<{ word: string; meaning_ko: string | null }> | null) ?? []).map(
      (w) => ({ word: w.word, meaningKo: w.meaning_ko }),
    ),
  }
}
