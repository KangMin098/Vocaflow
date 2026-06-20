// packages/library-pipeline/src/ingest-article/_mediawiki.ts
// ACP §18 — MediaWiki action API plain-text extract 공용 ingester.
//   Simple English Wikipedia / Wikinews 등 MediaWiki 사이트 공유.
//   GET <apiBase>?action=query&prop=extracts&explaintext=1&titles=<Title>

import type { ArticleSource, RawArticle } from '../types-article'

import { fetchWithTimeout } from './_helpers'

interface WikiPage {
  pageid?: number
  title?: string
  extract?: string
  fullurl?: string
  missing?: string
}

/** /wiki/Title URL 또는 raw 제목 → 정규화 제목. */
function titleFromInput(input: string): string {
  const m = input.match(/\/wiki\/([^?#]+)/i)
  const raw = m?.[1] ?? input
  try {
    return decodeURIComponent(raw).replace(/_/g, ' ').trim()
  } catch {
    return raw.replace(/_/g, ' ').trim()
  }
}

export interface MediaWikiOpts {
  /** 예: 'https://simple.wikipedia.org/w/api.php' */
  apiBase: string
  /** 예: 'https://simple.wikipedia.org/wiki/' */
  siteBase: string
  source: ArticleSource
  license: string
  author: string
  /** URL 또는 제목 */
  input: string
  /** 최소 본문 길이 (stub 가드) */
  minLen?: number
}

export async function ingestMediaWikiArticle(opts: MediaWikiOpts): Promise<RawArticle> {
  const title = titleFromInput(opts.input)
  if (!title) throw new Error(`${opts.source}: empty title`)

  const url =
    `${opts.apiBase}?action=query&format=json&redirects=1` +
    `&prop=extracts%7Cinfo&explaintext=1&exsectionformat=plain&inprop=url` +
    `&titles=${encodeURIComponent(title)}`

  const res = await fetchWithTimeout(url, { accept: 'application/json' })
  if (!res.ok) throw new Error(`${opts.source} fetch failed: ${res.status} ${title}`)

  const data = (await res.json()) as { query?: { pages?: Record<string, WikiPage> } }
  const page = data.query?.pages ? Object.values(data.query.pages)[0] : undefined
  if (!page || page.missing !== undefined) {
    throw new Error(`${opts.source}: page not found — "${title}"`)
  }

  const content = (page.extract ?? '').trim()
  const minLen = opts.minLen ?? 200
  if (content.length < minLen) {
    throw new Error(`${opts.source} body too short: ${content.length} chars (stub?)`)
  }

  const pageTitle = page.title ?? title
  const fullUrl =
    page.fullurl ?? `${opts.siteBase}${encodeURIComponent(title.replace(/ /g, '_'))}`
  const slug = (
    page.pageid != null
      ? String(page.pageid)
      : pageTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  ).slice(0, 60)

  return {
    source: opts.source,
    source_id: `${opts.source}:${slug}`,
    source_url: fullUrl,
    title: pageTitle,
    author: opts.author,
    language: 'en',
    license: opts.license,
    published_at: null, // wiki = 지속 편집
    content,
    estimated_cefr: null,
    fetched_at: new Date(),
  }
}
