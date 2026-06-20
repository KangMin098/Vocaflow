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
  // 책 제목 — Lit2Go 는 <h2> 사용 (멀티라인). <h1> 은 사이트 로고.
  const titleMatch = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)
  const title = stripHtml(titleMatch?.[1] ?? '').trim()

  // 저자/컬렉션/장르 anchor — 절대/상대 URL 모두 매칭.
  const authorMatch = html.match(
    /<a[^>]+href="(?:https?:\/\/etc\.usf\.edu)?\/lit2go\/authors\/[^"]+"[^>]*>([^<]+)<\/a>/i,
  )
  const author = authorMatch ? stripHtml(authorMatch[1] ?? '').trim() : undefined

  const collectionMatch = html.match(
    /<a[^>]+href="(?:https?:\/\/etc\.usf\.edu)?\/lit2go\/collections\/[^"]+"[^>]*>([^<]+)<\/a>/i,
  )
  const collection = collectionMatch ? stripHtml(collectionMatch[1] ?? '').trim() : undefined

  const genreMatch = html.match(
    /<a[^>]+href="(?:https?:\/\/etc\.usf\.edu)?\/lit2go\/genres\/[^"]+"[^>]*>([^<]+)<\/a>/i,
  )
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
  // 실제 passage URL = 5 segments + 절대 URL (책 페이지 confirmed 마크업):
  //   https://etc.usf.edu/lit2go/{book-id}/{book-slug}/{passage-id}/{passage-slug}/
  // 책 자체 짧은 URL (`/lit2go/{book-id}/`) 은 redirect 만 있고 본문 없음 → 5-seg 만 채택.
  const urls = new Set<string>()
  const re = new RegExp(
    `<a[^>]+href="(?:https?:\\/\\/etc\\.usf\\.edu)?(\\/lit2go\\/${bookId}\\/[a-z0-9\\-]+\\/\\d+\\/[a-z0-9\\-]+\\/)"`,
    'gi',
  )
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    urls.add(`https://etc.usf.edu${m[1]!}`)
  }
  return Array.from(urls)
}

function extractPassageBody(html: string): string {
  // Lit2Go passage 본문은 `<div id="i_apologize_for_the_soup">` 안 <p> 들 (confirmed).
  // (이전 entry-content / <article> wrapper 가정은 WordPress 기본 가정 — Lit2Go 와 안 맞음.)
  // 컨테이너 안에는 <audio> / <source> / <nav class="passage"> 등 노이즈가 함께 있어 사전 제거.
  const m = html.match(
    /<div[^>]+id="i_apologize_for_the_soup"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i,
  )
  if (!m) {
    // 폴백 1: id 변경 시 <article> 시도
    const am = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)
    if (am) return htmlToPlainText(am[1] ?? '')
    return ''
  }
  let body = m[1] ?? ''
  // 오디오 플레이어 / 캡션 / 네비게이션 제거
  body = body.replace(/<audio[\s\S]*?<\/audio>/gi, '')
  body = body.replace(/<source[^>]*\/?>/gi, '')
  body = body.replace(/<nav[\s\S]*?<\/nav>/gi, '')
  return htmlToPlainText(body)
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
    // USF Lit2Go 본문은 곱슬따옴표를 named entity 로 씀 — 미디코딩 시 ldquo/rdquo/
    //   lsquo/rsquo 가 단어로 잡히고 s&rsquo;pose 류 contraction 이 쪼개짐 (Huck Finn 618 미바인딩 주범).
    .replace(/&rsquo;/g, '’')
    .replace(/&lsquo;/g, '‘')
    .replace(/&rdquo;/g, '”')
    .replace(/&ldquo;/g, '“')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}
