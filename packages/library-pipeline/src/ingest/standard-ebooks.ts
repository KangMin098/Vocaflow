// packages/library-pipeline/src/ingest/standard-ebooks.ts
// Phase 13 — Standard Ebooks ingester
//
// SE는 EPUB 외에도 single-page HTML reader 제공 → EPUB 파싱 없이 Gutenberg와
// 동일한 RawBook shape 반환 가능. 의존성 0 추가.
//
// URL 패턴:
//   메타: https://standardebooks.org/ebooks/<author-slug>/<title-slug>
//   본문: https://standardebooks.org/ebooks/<author-slug>/<title-slug>/text/single-page
//   OPDS: https://standardebooks.org/opds/all
//
// source_id 형식: "<author-slug>/<title-slug>" (예: "lewis-carroll/alice-s-adventures-in-wonderland")

import type { RawBook } from '../types'

const SE_BASE = 'https://standardebooks.org'
const USER_AGENT = 'Vocaflow-LCP/2.0 (research)'

interface SEMeta {
  title: string
  author?: string
  author_birth_year?: number
  author_death_year?: number
  language: string
  license: string
}

/**
 * Standard Ebooks source_id 로 raw 본문 + 메타 가져오기.
 * Rate limit: 60초당 5건 권장 (호출자 책임).
 *
 * @param sourceId "<author-slug>/<title-slug>" (예: 'lewis-carroll/alice-s-adventures-in-wonderland')
 * @returns RawBook (Stage S3 NORMALIZE 입력)
 */
export async function ingestFromStandardEbooks(sourceId: string): Promise<RawBook> {
  if (!/^[a-z0-9-]+\/[a-z0-9-]+(?:\/[a-z0-9-]+)?$/.test(sourceId)) {
    throw new Error(`Invalid Standard Ebooks source_id: ${sourceId}`)
  }

  const ebookUrl = `${SE_BASE}/ebooks/${sourceId}`

  // 1. 메타 fetch (SE는 illustrator 포함 canonical slug로 301 redirect 가능)
  const metaRes = await fetch(ebookUrl, {
    headers: { 'User-Agent': USER_AGENT },
  })
  if (!metaRes.ok) {
    throw new Error(`SE meta fetch failed: ${metaRes.status} ${ebookUrl}`)
  }
  const metaHtml = await metaRes.text()
  const meta = parseMetaHtml(metaHtml)

  // canonical URL (redirect 따라간 후) 기준으로 single-page URL 파생
  const canonicalEbookUrl = metaRes.url.replace(/\/+$/, '')
  const textUrl = `${canonicalEbookUrl}/text/single-page`

  // 2. 단일 페이지 본문 fetch (모든 chapter 포함된 HTML)
  const textRes = await fetch(textUrl, {
    headers: { 'User-Agent': USER_AGENT },
  })
  if (!textRes.ok) {
    throw new Error(`SE single-page fetch failed: ${textRes.status} ${textUrl}`)
  }
  const fullHtml = await textRes.text()

  // 3. HTML → plain text 변환 (chapter <section> 경계는 마커로 보존하여 segmenter가 분절)
  const raw_content = htmlToPlainText(fullHtml)

  return {
    source: 'standard_ebooks',
    source_id: sourceId,
    source_url: textUrl,
    title: meta.title,
    ...(meta.author !== undefined && { author: meta.author }),
    ...(meta.author_birth_year !== undefined && {
      author_birth_year: meta.author_birth_year,
    }),
    ...(meta.author_death_year !== undefined && {
      author_death_year: meta.author_death_year,
    }),
    language: meta.language,
    license: meta.license,
    raw_content,
    fetched_at: new Date(),
  }
}

/**
 * SE ebook 메타 HTML 에서 title / author / 생몰년 / language / license 파싱.
 * SE는 schema.org microdata 풍부하므로 정규식만으로 충분.
 */
function parseMetaHtml(html: string): SEMeta {
  const get = (re: RegExp): string | undefined => {
    const m = html.match(re)
    return m?.[1]?.trim()
  }

  // <h1 property="schema:name" ...>Title</h1> 또는 <title>Title — Standard Ebooks</title>
  const title =
    get(/<h1[^>]*property="schema:name"[^>]*>([^<]+)<\/h1>/) ??
    get(/<h1[^>]*>([^<]+)<\/h1>/) ??
    get(/<title>([^<—]+?)(?:\s*[—–-]\s*Standard Ebooks)?<\/title>/)

  if (!title) {
    throw new Error('SE meta: title not found')
  }

  // SE 패턴: <a property="schema:author" typeof="schema:Person" ...>
  //          <span property="schema:name">Author Name</span> ...
  // 1차: schema:author 블록 내부 schema:name span 추출 (nested)
  // 2차: 일반 <a property="schema:author">Direct Text</a> fallback
  const authorBlock = html.match(
    /<a[^>]*property="schema:author"[^>]*>([\s\S]*?)<\/a>/,
  )?.[1]
  const author =
    (authorBlock &&
      authorBlock.match(/<span[^>]*property="schema:name"[^>]*>([^<]+)<\/span>/)?.[1]?.trim()) ||
    get(/<a[^>]*property="schema:author"[^>]*>([^<]+)<\/a>/)

  // SE는 ebook page 에 birthDate/deathDate 직접 노출 안 함 — undefined.
  // (seed-enqueue 사용 시 curated-seed.json 의 값이 admin_enqueue_book 으로 직접 전달됨)
  const birth = get(/property="schema:birthDate"[^>]*content="(\d{4})/)
  const death = get(/property="schema:deathDate"[^>]*content="(\d{4})/)

  // SE는 모든 책이 PD 또는 CC0 (License: U.S. Public Domain or CC0)
  const license =
    get(/<a[^>]+href="\/licenses\/[^"]*"[^>]*>([^<]+)<\/a>/) ??
    'U.S. Public Domain'

  return {
    title: title,
    ...(author !== undefined && { author }),
    ...(birth !== undefined && { author_birth_year: parseInt(birth, 10) }),
    ...(death !== undefined && { author_death_year: parseInt(death, 10) }),
    language: 'en',
    license,
  }
}

/**
 * SE single-page HTML → plain text 변환.
 * - <section> 경계: 빈 줄 2개 (segmenter chapter 감지 도움)
 * - <h2>~<h6>: 줄바꿈 + 제목 (segmenter chapter 패턴 감지)
 * - <p>: 줄바꿈
 * - 기타 태그 stripped
 * - HTML entity 디코딩 (최소)
 */
function htmlToPlainText(html: string): string {
  // 1. <body> 만 추출
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  let work = bodyMatch ? bodyMatch[1]! : html

  // 2. <header>, <nav>, <footer>, <script>, <style> 제거 (boilerplate)
  work = work.replace(/<(header|nav|footer|script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')

  // 3. section 경계 → 빈 줄 2개 (chapter 분절)
  work = work.replace(/<section\b[^>]*>/gi, '\n\n\n')
  work = work.replace(/<\/section>/gi, '\n\n')

  // 4. heading → "\n\n제목\n\n" (segmenter ALLCAPS/CHAPTER 패턴 감지)
  work = work.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, '\n\n$2\n\n')

  // 5. block-level → 줄바꿈
  work = work.replace(/<\/(p|div|li|blockquote|hr|br)>/gi, '\n')
  work = work.replace(/<br\s*\/?>/gi, '\n')

  // 6. 모든 남은 태그 strip
  work = work.replace(/<[^>]+>/g, '')

  // 7. HTML entity 디코딩 (최소)
  work = work
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
    .replace(/&rsquo;/g, '’')
    .replace(/&lsquo;/g, '‘')
    .replace(/&rdquo;/g, '”')
    .replace(/&ldquo;/g, '“')

  // 8. whitespace 정규화 (3+ 개 newline → 2개)
  work = work.replace(/[ \t]+/g, ' ')
  work = work.replace(/\n{3,}/g, '\n\n\n')
  work = work.replace(/^[ \t]+|[ \t]+$/gm, '')

  return work.trim()
}
