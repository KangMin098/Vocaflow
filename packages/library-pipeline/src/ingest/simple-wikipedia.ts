// packages/library-pipeline/src/ingest/simple-wikipedia.ts
// LCP v2.0 — Simple English Wikipedia ingester
//
// Simple English Wikipedia (simple.wikipedia.org) — 통제어휘 + 단순 문장 위키.
// CC BY-SA 3.0 + GFDL. 200K+ articles.
//
// Wikibooks 와 차이:
//   - 단일 페이지 article (sub-page 트리 없음)
//   - 학습 친화 통제어휘 (~2,000 코어)
//
// source_id: title slug (공백 → _ 변환)
// 예: 'Albert_Einstein' · 'Photosynthesis'

import type { RawBook } from '../types'

const SW_API = 'https://simple.wikipedia.org/w/api.php'
const SW_PAGE_URL = (title: string): string =>
  `https://simple.wikipedia.org/wiki/${encodeURIComponent(title)}`
const USER_AGENT = 'Vocaflow-LCP/2.0 (research; https://vocaflow.app)'
const FETCH_TIMEOUT_MS = 15_000
const MIN_BODY_CHARS = 200

/**
 * Simple Wikipedia page title 로 raw 본문 + 메타 가져오기.
 * - source_id 가 숫자만 (pageid) → title 자동 변환 (legacy 호환)
 * - 본문 < MIN_BODY_CHARS → 에러 (stub article 차단)
 */
export async function ingestFromSimpleWikipedia(
  pageTitle: string,
): Promise<RawBook> {
  const raw = pageTitle.trim()

  // pageid (숫자) → title 변환
  let normalized: string
  if (/^\d+$/.test(raw)) {
    const resolvedTitle = await resolveTitleFromPageId(raw)
    if (!resolvedTitle) {
      throw new Error(`Simple Wikipedia page id not found: ${raw}`)
    }
    normalized = resolvedTitle.replace(/\s+/g, '_')
  } else {
    normalized = raw.replace(/\s+/g, '_')
    if (!/^[A-Za-z0-9_/().,:'\-]+$/.test(normalized)) {
      throw new Error(`Invalid Simple Wikipedia page title: ${pageTitle}`)
    }
  }

  // 1. 메타 (canonical title)
  const meta = await fetchMeta(normalized)
  if (!meta) {
    throw new Error(`Simple Wikipedia page not found: ${normalized}`)
  }

  // 2. 본문 (single-page)
  const body = await fetchPagePlainText(normalized)
  if (!body || body.trim().length < MIN_BODY_CHARS) {
    throw new Error(
      `Simple Wikipedia body too short: ${body?.trim().length ?? 0} chars (min ${MIN_BODY_CHARS}) for ${normalized}`,
    )
  }

  // 3. RawBook return — single-page article 은 chapter 1개
  //    segment-book 정규식 분리기 호환 위해 "Chapter 1" 헤더 prefix
  const content = `\n\n\nChapter 1. ${meta.title}\n\n${body.trim()}`

  return {
    source: 'simple_wikipedia',
    source_id: normalized,
    source_url: SW_PAGE_URL(normalized),
    title: meta.title,
    author: 'Wikipedia contributors',
    language: 'en',
    license: 'CC-BY-SA-3.0',
    raw_content: content,
    fetched_at: new Date(),
  }
}

// ─────────────────────────────────────────────
// Helpers (Wikibooks 패턴 재사용)
// ─────────────────────────────────────────────

interface SimpleWikiMeta {
  title: string
  pageId: number
}

async function resolveTitleFromPageId(pageid: string): Promise<string | null> {
  const url = `${SW_API}?action=query&format=json&prop=info&pageids=${pageid}&origin=*`
  try {
    const res = await fetchWithTimeout(url)
    if (!res.ok) return null
    const json = (await res.json()) as {
      query?: { pages?: Record<string, { title?: string; missing?: '' }> }
    }
    const first = Object.values(json.query?.pages ?? {})[0]
    if (!first || first.missing !== undefined || !first.title) return null
    return first.title
  } catch {
    return null
  }
}

async function fetchMeta(title: string): Promise<SimpleWikiMeta | null> {
  const url = `${SW_API}?action=query&format=json&prop=info&titles=${encodeURIComponent(title)}&origin=*`
  const res = await fetchWithTimeout(url)
  if (!res.ok) throw new Error(`Simple Wikipedia meta fetch failed: ${res.status}`)
  const json = (await res.json()) as {
    query?: { pages?: Record<string, { pageid?: number; title?: string; missing?: '' }> }
  }
  const first = Object.values(json.query?.pages ?? {})[0]
  if (!first || first.missing !== undefined || !first.pageid || !first.title) return null
  return { title: first.title, pageId: first.pageid }
}

async function fetchPagePlainText(title: string): Promise<string | null> {
  const url = `${SW_API}?action=parse&format=json&page=${encodeURIComponent(title)}&prop=text&disablelimitreport=1&disableeditsection=1&disabletoc=1&origin=*`
  const res = await fetchWithTimeout(url)
  if (!res.ok) return null
  const json = (await res.json()) as {
    parse?: { text?: { '*'?: string } }
    error?: { code?: string }
  }
  if (json.error || !json.parse?.text?.['*']) return null
  return htmlToPlainText(json.parse.text['*'])
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * MediaWiki HTML → plain text. Wikibooks 와 동일 stripping 룰.
 */
function htmlToPlainText(html: string): string {
  let s = html
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  s = s.replace(
    /<(?:div|table)[^>]*class="[^"]*(?:navigation|infobox|metadata|reference|toc|navbox|noprint|mw-editsection|sister-project|mw-jump-link|hatnote|thumbcaption|gallery)[^"]*"[^>]*>[\s\S]*?<\/(?:div|table)>/gi,
    '',
  )
  s = s.replace(/<sup[^>]*class="[^"]*reference[^"]*"[^>]*>[\s\S]*?<\/sup>/gi, '')
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<\/(?:p|h[1-6]|li|tr|div)>/gi, '\n')
  s = s.replace(/<h([1-6])[^>]*>/gi, '\n\n')
  s = s.replace(/<[^>]+>/g, '')
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return s
}
