// packages/library-pipeline/src/ingest/librivox.ts
// LCP v2.0 — LibriVox ingester
//
// LibriVox 는 오디오북 (MP3) 카탈로그 — 본문 텍스트는 직접 제공하지 않고
// `url_text_source` 필드로 외부 텍스트 원본 (Gutenberg, Wikisource, archive.org 등) 을 가리킴.
//
// 전략:
//   1) LibriVox API 로 메타 fetch (저자 생몰년 포함 → kr_safe 자동 계산 가능)
//   2) url_text_source 가 Gutenberg URL → ingestFromGutenberg 로 위임 (텍스트는 Gutenberg 본문)
//   3) 그 외 URL → 직접 fetch + HTML→plain 변환 (best-effort)
//   4) url_text_source 없으면 throw — 텍스트 원본 없는 LibriVox 항목은 LCP 파이프라인 불가
//
// source_id 형식: LibriVox book id (숫자 문자열, 예: "1", "13") 또는 RSS-style URL slug
//
// 호출 패턴:
//   const raw = await ingestFromLibriVox('1')

import type { RawBook } from '../types'
import { ingestFromGutenberg } from './gutenberg'

const LV_API = 'https://librivox.org/api/feed/audiobooks'
const LV_PAGE_URL = (id: string): string => `https://librivox.org/?p=${id}`
const USER_AGENT = 'Vocaflow-LCP/2.0 (research; https://vocaflow.app)'
const FETCH_TIMEOUT_MS = 20_000
const MAX_TEXT_BYTES = 8 * 1024 * 1024 // 8MB — Gutenberg 평균 본문보다 충분

interface LibriVoxAuthor {
  id?: number
  first_name?: string | null
  last_name?: string | null
  dob?: string | null
  dod?: string | null
}

interface LibriVoxBook {
  id: number | string
  title: string
  description?: string
  language?: string
  url_text_source?: string | null
  url_librivox?: string | null
  authors?: LibriVoxAuthor[]
}

/**
 * LibriVox book id 로 raw 본문 + 메타 가져오기.
 *
 * @param idStr LibriVox book id (예: '1', '13')
 * @returns RawBook (Stage S3 NORMALIZE 입력)
 */
export async function ingestFromLibriVox(idStr: string): Promise<RawBook> {
  const id = idStr.trim()
  if (!/^[A-Za-z0-9_\-]+$/.test(id)) {
    throw new Error(`Invalid LibriVox id: ${idStr}`)
  }

  // 1. 메타 fetch
  const metaUrl = `${LV_API}/?id=${encodeURIComponent(id)}&format=json`
  const metaRes = await fetchWithTimeout(metaUrl)
  if (!metaRes.ok) {
    throw new Error(`LibriVox meta fetch failed: ${metaRes.status}`)
  }
  const metaJson = (await metaRes.json()) as { books?: LibriVoxBook[] }
  const book = metaJson.books?.[0]
  if (!book) {
    throw new Error(`LibriVox book not found: ${id}`)
  }

  const author = formatAuthor(book.authors)
  const birth = parseYear(book.authors?.[0]?.dob)
  const death = parseYear(book.authors?.[0]?.dod)
  const lvPageUrl = book.url_librivox ?? LV_PAGE_URL(id)

  // 2. 텍스트 원본 결정
  const textSourceUrl = book.url_text_source?.trim()
  if (!textSourceUrl) {
    throw new Error(
      `LibriVox book ${id} has no url_text_source — text 원본 없음, LCP 처리 불가`,
    )
  }

  // 3. Gutenberg URL 패턴 → 위임 (Gutenberg 본문 정밀 파싱 재사용)
  const gutenbergId = extractGutenbergId(textSourceUrl)
  if (gutenbergId) {
    const gut = await ingestFromGutenberg(gutenbergId)
    // LibriVox 출처로 attribution 변경, 나머지 메타는 LibriVox 우선
    return {
      source: 'librivox',
      source_id: id,
      source_url: lvPageUrl,
      title: book.title || gut.title,
      ...(author !== undefined && { author }),
      ...(birth !== undefined && { author_birth_year: birth }),
      ...(death !== undefined && { author_death_year: death }),
      language: book.language ?? gut.language,
      license: gut.license, // Gutenberg 본문이라 PD-US 라이선스 그대로
      raw_content: gut.raw_content,
      fetched_at: new Date(),
    }
  }

  // 4. 그 외 URL → 직접 fetch + plain text 변환
  const textRes = await fetchWithTimeout(textSourceUrl)
  if (!textRes.ok) {
    throw new Error(
      `LibriVox url_text_source fetch failed: ${textRes.status} ${textSourceUrl}`,
    )
  }
  const contentType = textRes.headers.get('content-type') ?? ''
  const buf = await textRes.arrayBuffer()
  if (buf.byteLength > MAX_TEXT_BYTES) {
    throw new Error(
      `LibriVox url_text_source too large: ${buf.byteLength} bytes (max ${MAX_TEXT_BYTES})`,
    )
  }
  const decoded = new TextDecoder('utf-8').decode(buf)
  const rawContent = contentType.includes('html')
    ? htmlToPlainText(decoded)
    : decoded

  if (rawContent.trim().length < 500) {
    throw new Error(
      `LibriVox text source too short: ${rawContent.trim().length} chars`,
    )
  }

  return {
    source: 'librivox',
    source_id: id,
    source_url: lvPageUrl,
    title: book.title,
    ...(author !== undefined && { author }),
    ...(birth !== undefined && { author_birth_year: birth }),
    ...(death !== undefined && { author_death_year: death }),
    language: book.language ?? 'en',
    license: 'PD', // LibriVox 는 전부 PD 또는 CC0 — text 원본도 PD 전제
    raw_content: rawContent,
    fetched_at: new Date(),
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatAuthor(authors: LibriVoxAuthor[] | undefined): string | undefined {
  if (!authors || authors.length === 0) return undefined
  const a = authors[0]!
  const parts = [a.first_name, a.last_name].filter(
    (s): s is string => typeof s === 'string' && s.trim().length > 0,
  )
  if (parts.length === 0) return undefined
  const name = parts.join(' ').trim()
  if (authors.length > 1) return `${name} et al.`
  return name
}

function parseYear(y: string | null | undefined): number | undefined {
  if (!y) return undefined
  const trimmed = y.trim()
  if (!trimmed) return undefined
  const n = parseInt(trimmed, 10)
  if (Number.isNaN(n)) return undefined
  // LibriVox 일부 항목은 "-50" 식 BC 연도 — 그대로 사용
  if (n > 2100 || n < -3000) return undefined
  return n
}

function extractGutenbergId(url: string): string | null {
  // 다양한 Gutenberg URL 형식 지원:
  //   https://www.gutenberg.org/ebooks/1342
  //   https://www.gutenberg.org/cache/epub/1342/pg1342.txt
  //   https://www.gutenberg.org/files/1342/1342-0.txt
  //   http://gutenberg.org/...
  const m = url.match(
    /(?:^|\/\/)(?:www\.)?gutenberg\.org\/(?:ebooks|cache\/epub|files)\/(\d{1,7})\b/i,
  )
  return m?.[1] ?? null
}

/**
 * 단순 HTML → plain text. 외부 의존성 0.
 * archive.org / sacred-texts.com 등 LibriVox text source 가 가리키는 다양한
 * 호스트의 페이지를 best-effort 로 처리. 정확도는 chapter 분절에 의존.
 */
function htmlToPlainText(html: string): string {
  let s = html
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  s = s.replace(/<header[\s\S]*?<\/header>/gi, '')
  s = s.replace(/<footer[\s\S]*?<\/footer>/gi, '')
  s = s.replace(/<nav[\s\S]*?<\/nav>/gi, '')
  s = s.replace(/<aside[\s\S]*?<\/aside>/gi, '')
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<\/(?:p|h[1-6]|li|tr|div|section|article)>/gi, '\n')
  s = s.replace(/<h([1-6])[^>]*>/gi, '\n\n')
  s = s.replace(/<[^>]+>/g, '')
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ')
  return s.trim()
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, text/html, text/plain' },
    })
  } finally {
    clearTimeout(timer)
  }
}
