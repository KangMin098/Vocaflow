// packages/library-pipeline/src/ingest/lit2go.ts
// LCP v2.0 — Lit2Go (USF) ingester
//
// Lit2Go = University of South Florida 운영 K-12 학습용 짧은 지문·시·이야기 라이브러리.
// 본문 = Public Domain (저작권 소멸 작품), USF 가 작성한 요약/줄거리 = CC-BY (인용 권장).
//
// ─── 사용자 정책 (외부 비평 반영) ────────────────────────────────────────
//
// Lit2Go US grade (Flesch-Kincaid) ≠ CEFR ≠ EFL 한국 학습자 V-Level.
// → 본 ingester 는 metadata 만 보존. **최종 V-Level 은 analyze 단계의 coverage 모델
//    (lexical_coverage + lemma_coverage_pct) 가 SSoT.**
//
// 보존 필드 (analyze 후 curation_metadata 로 흐름):
//   · lit2go_grade        — US Flesch-Kincaid 학년 (rosetta 신호)
//   · lit2go_collection   — 컬렉션 (예: Aesop's Fables, Twain Short Stories)
//   · content_maturity    — kids/teen/adult (hi-lo 표시)
//   · audio_url           — USF audiobook MP3 (있을 때)
//
// URL 패턴:
//   책 페이지: https://etc.usf.edu/lit2go/{book-id}/
//   본문 (passage): https://etc.usf.edu/lit2go/{book-id}/{passage-slug}/

import type { RawBook } from '../types'

const LIT2GO_BASE = 'https://etc.usf.edu/lit2go'
const USER_AGENT = 'Vocaflow-LCP/2.0 (research)'

interface Lit2GoMeta {
  title: string
  author?: string
  collection?: string
  genre?: string
  /** Flesch-Kincaid 미국 학년 수치 (예: 7.3). NULL=Lit2Go 미명시 */
  fkGrade?: number | null
  /** USF 작성 요약/줄거리 (CC-BY) */
  summary?: string
  /** 오디오 MP3 (USF audiobooks) */
  audioUrl?: string
  /** 단어수 (Lit2Go 명시) */
  wordCount?: number
}

/**
 * Lit2Go book ID 로 raw 본문 + 메타 가져오기.
 *
 * @param sourceId 'lit2go:{book-id}' 또는 그냥 '{book-id}'
 * @returns RawBook (Stage S3 NORMALIZE 입력)
 */
export async function ingestFromLit2Go(sourceId: string): Promise<RawBook> {
  const bookId = sourceId.replace(/^lit2go:/, '').trim()
  if (!/^\d+$/.test(bookId)) {
    throw new Error(`Invalid Lit2Go book ID: ${sourceId}`)
  }

  const bookUrl = `${LIT2GO_BASE}/${bookId}/`

  // 1. 책 페이지 메타 + passage 목록
  const metaRes = await fetch(bookUrl, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
  })
  if (!metaRes.ok) {
    throw new Error(`Lit2Go book page fetch failed: ${metaRes.status}`)
  }
  const metaHtml = await metaRes.text()
  const meta = parseBookMeta(metaHtml)
  const passageUrls = parsePassageUrls(metaHtml, bookId)

  // 2. 본문 추출 — passage 가 있으면 각 passage 본문 결합, 없으면 책 페이지 자체에서 추출
  let rawContent: string
  if (passageUrls.length > 0) {
    const passages: string[] = []
    for (const pUrl of passageUrls) {
      try {
        const res = await fetch(pUrl, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
        })
        if (!res.ok) continue
        const html = await res.text()
        const body = extractPassageBody(html)
        if (body && body.length > 100) {
          passages.push(body)
        }
        // USF 서버 부하 보호 — 짧은 sleep (Node 18+)
        await new Promise((r) => setTimeout(r, 150))
      } catch {
        // skip 실패 passage
      }
    }
    rawContent = passages.join('\n\n---\n\n')
  } else {
    rawContent = extractPassageBody(metaHtml) ?? ''
  }

  if (rawContent.trim().length < 200) {
    throw new Error(`Lit2Go book body too short: ${rawContent.trim().length} chars`)
  }

  return {
    source: 'lit2go',
    source_id: `lit2go:${bookId}`,
    source_url: bookUrl,
    title: meta.title || `Lit2Go #${bookId}`,
    author: meta.author,
    language: 'en',
    license: 'PD-Body / CC-BY-Summary',
    raw_content: rawContent,
    fetched_at: new Date(),
  }
}

// ───────────────────────────────────────────────────────
// HTML parsing helpers (의존성 0, 정규식 기반)
// ───────────────────────────────────────────────────────

function parseBookMeta(html: string): Lit2GoMeta {
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
  const title = stripHtml(titleMatch?.[1] ?? '').trim()

  const authorMatch = html.match(
    /<a[^>]+href="\/lit2go\/authors\/[^"]+"[^>]*>([^<]+)<\/a>/i,
  )
  const author = authorMatch ? stripHtml(authorMatch[1] ?? '').trim() : undefined

  const collectionMatch = html.match(
    /<a[^>]+href="\/lit2go\/collections\/[^"]+"[^>]*>([^<]+)<\/a>/i,
  )
  const collection = collectionMatch ? stripHtml(collectionMatch[1] ?? '').trim() : undefined

  const genreMatch = html.match(/<a[^>]+href="\/lit2go\/genres\/[^"]+"[^>]*>([^<]+)<\/a>/i)
  const genre = genreMatch ? stripHtml(genreMatch[1] ?? '').trim() : undefined

  const gradeMatch = html.match(/Reading\s+Level[^0-9]*([\d.]+)/i)
  const fkGrade = gradeMatch ? parseFloat(gradeMatch[1] ?? '') : null

  const wordMatch = html.match(/([\d,]+)\s*words?/i)
  const wordCount = wordMatch
    ? parseInt((wordMatch[1] ?? '').replace(/,/g, ''), 10)
    : undefined

  const audioMatch = html.match(/<a[^>]+href="([^"]+\.mp3)"/i)
  const audioUrl = audioMatch?.[1]

  // USF 요약 - 책 페이지의 첫 큰 <p>
  const summaryMatch = html.match(
    /<div[^>]+class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  )
  const summary = summaryMatch ? stripHtml(summaryMatch[1] ?? '').trim() : undefined

  return { title, author, collection, genre, fkGrade, wordCount, audioUrl, summary }
}

function parsePassageUrls(html: string, bookId: string): string[] {
  // passage URL: /lit2go/{book-id}/{passage-slug}/
  const urls = new Set<string>()
  const re = new RegExp(`<a[^>]+href="(\\/lit2go\\/${bookId}\\/[a-z0-9\\-]+\\/)"`, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    urls.add(`https://etc.usf.edu${m[1]!}`)
  }
  return Array.from(urls)
}

function extractPassageBody(html: string): string {
  // Lit2Go passage 본문: <div class="entry-content"> 또는 <article> 중 첫 매치
  const m =
    html.match(/<div[^>]+class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/(?:div|main|article)>/i) ??
    html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)
  if (!m) return ''
  return htmlToPlainText(m[1] ?? '')
}

function htmlToPlainText(html: string): string {
  let s = html
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  s = s.replace(/<figure\b[\s\S]*?<\/figure>/gi, '\n')
  s = s.replace(/<aside\b[\s\S]*?<\/aside>/gi, '\n')
  s = s.replace(/<nav\b[\s\S]*?<\/nav>/gi, '')
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<\/(?:p|h[1-6]|li|tr|div|section|article)>/gi, '\n')
  s = s.replace(/<h([1-6])[^>]*>/gi, '\n\n')
  s = s.replace(/<[^>]+>/g, '')
  s = decodeEntities(s)
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim()
}

function stripHtml(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, '')).trim()
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&hellip;/g, '…')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}
