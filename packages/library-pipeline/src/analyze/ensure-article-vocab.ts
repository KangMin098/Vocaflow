// packages/library-pipeline/src/analyze/ensure-article-vocab.ts
//
// 발행 직전에 **글의 어휘 행이 있는지 확인하고, 없으면 본문에서 다시 만든다.**
//
// 왜: `library_article_vocabularies` 의 98.6% 는 발행되지 않을 `ready` 글 몫이다
//   (docs/reports/lav-retention-2026-09-24.md). 그 몫을 걷어내려면 발행 경로가 행 없이도
//   동작해야 한다. 행이 없는 글을 그대로 발행하면 `publish_article_word_set` 첫 줄의
//   품질 게이트 「추출 비어있음(0단어)」 가 막고, 메시지는 「콘텐츠 품질 게이트 FAIL」 뿐이라
//   원인이 어휘 부재라는 게 안 보인다. 그래서 발행 **앞에서** 채운다.
//
// 배치 경로(`scripts/acp/process-queue.mjs` · `reprocess.mjs`)와 **같은 설정**으로 만든다 —
//   `reflowSoftHyphens(..., { joinHyphenLineBreaks: false })` → `analyzeArticle` → `compute_article_vrl`.
//   설정이 갈리면 화면으로 발행한 글과 배치로 만든 글의 어휘가 달라진다.
// `skipLlm: true` 로 돈다 — LLM 경로는 사전 미등재 낱말을 `shared_dictionary` 에 **써 넣는**
//   부수효과와 비용이 있다. 발행 버튼이 사전을 바꾸면 안 된다. 재현성 실측(6편 2,565행 비트 일치,
//   `20260901040000_lav_drop_dead_columns`)도 LLM 없이 잰 것이다.
// 글의 상태·CEFR·길이 같은 메타는 **건드리지 않는다** — 이 함수는 어휘 캐시만 채운다.

import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { AnalyzedArticle, ArticleSource, NormalizedArticle } from '../types-article'
import { normalizePunctuation, reflowSoftHyphens } from '../normalize'
import { getServiceClient } from '../client'
import { analyzeArticle, type AnalyzeArticleOptions } from './analyze-article'

export interface EnsureArticleVocabResult {
  /** true = 행이 없어 이번에 다시 만들었다 */
  rebuilt: boolean
  /** 확인 시점(rebuilt=false) 또는 재생성 후(rebuilt=true)의 행 수 */
  rows: number
  /** `compute_article_vrl` 실패 메시지 — 치명적이지 않다(기존 `article_v_level` 이 남는다) */
  vrlWarning: string | null
}

export interface EnsureArticleVocabDeps {
  client?: SupabaseClient
  analyze?: (
    articleId: string,
    norm: NormalizedArticle,
    options?: AnalyzeArticleOptions,
  ) => Promise<Pick<AnalyzedArticle, 'words'>>
  /** `RawArticle.fetched_at` 에 들어갈 시각 — 로직 안에서 시계를 읽지 않는다 */
  now: () => Date
}

interface ArticleRow {
  source: string
  source_id: string | null
  source_url: string | null
  title: string | null
  author: string | null
  language: string | null
  license: string | null
  content: string | null
  published_at: string | null
}

export async function ensureArticleVocab(
  articleId: string,
  deps: EnsureArticleVocabDeps,
): Promise<EnsureArticleVocabResult> {
  const client = deps.client ?? getServiceClient()
  const analyze = deps.analyze ?? analyzeArticle

  // 1) 행이 있나 — 못 읽었으면 「없음」으로 치지 않는다(오류를 0 으로 삼키면 멀쩡한 글을 다시 쓴다).
  const { count, error: countErr } = await client
    .from('library_article_vocabularies')
    .select('library_article_id', { count: 'exact', head: true })
    .eq('library_article_id', articleId)
  if (countErr) {
    throw new Error(`어휘 행 수를 읽지 못했다 (article ${articleId}): ${countErr.message}`)
  }
  if (count === null) {
    throw new Error(`어휘 행 수가 null 이다 (article ${articleId}) — 0 으로 간주하지 않는다`)
  }
  if (count > 0) return { rebuilt: false, rows: count, vrlWarning: null }

  // 2) 본문
  const { data, error: fetchErr } = await client
    .from('library_articles')
    .select('source, source_id, source_url, title, author, language, license, content, published_at')
    .eq('id', articleId)
    .maybeSingle()
  if (fetchErr) throw new Error(`글을 읽지 못했다 (article ${articleId}): ${fetchErr.message}`)
  const a = data as ArticleRow | null
  if (!a) throw new Error(`글이 없다 (article ${articleId})`)
  const content = a.content ?? ''
  if (content.trim().length === 0) {
    throw new Error(`본문이 비어 어휘를 다시 만들 수 없다 (article ${articleId})`)
  }

  // 3) 배치 경로와 같은 정규화 → 분석(어휘 행 재삽입)
  const body = reflowSoftHyphens(normalizePunctuation(content), { joinHyphenLineBreaks: false })
  const norm: NormalizedArticle = {
    raw: {
      source: a.source as ArticleSource,
      source_id: a.source_id ?? '',
      source_url: a.source_url ?? '',
      title: a.title ?? '',
      author: a.author ?? undefined,
      language: a.language ?? 'en',
      license: a.license ?? '',
      published_at: a.published_at ? new Date(a.published_at) : null,
      content,
      estimated_cefr: null,
      fetched_at: deps.now(),
    },
    body,
    body_hash: createHash('sha256').update(body).digest('hex'),
  }
  const result = await analyze(articleId, norm, { skipLlm: true })

  // 4) V-Level — `select_article_vocab` 의 게이트 기준선. 실패해도 발행은 기존 값으로 간다.
  const { error: vrlErr } = await client.rpc('compute_article_vrl', { p_article_id: articleId })

  return {
    rebuilt: true,
    rows: result.words.length,
    vrlWarning: vrlErr ? vrlErr.message : null,
  }
}
